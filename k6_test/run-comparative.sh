#!/bin/bash
#
# =============================================================================
# K6 COMPARATIVE TEST RUNNER
# Seed Certification System — 4 Skenario Pengujian
# =============================================================================
#
# Menjalankan 4 skenario K6 test secara berurutan:
#   1. Hyperledger only (Baseline)
#   2. Hyperledger + IPFS
#   3. Hyperledger + ZTA
#   4. Hyperledger + ZTA + IPFS (Full Stack)
#
# Setelah selesai, menghasilkan laporan komparatif dalam format CSV.
#
# Penggunaan:
#   ./run-comparative.sh              # Run semua skenario
#   ./run-comparative.sh --quick      # Run dengan VU lebih sedikit (smoke test)
#   ./run-comparative.sh --scenario 1 # Run skenario tertentu saja
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# =============================================================================
# CONFIGURATION
# =============================================================================
REPORTS_DIR="reports"
COMPARATIVE_DIR="$REPORTS_DIR/comparative"
SCENARIO_DIR=$(dirname "$0")

# Timestamp unik untuk sesi pengujian ini
SESSION_TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Generate session ID — pakai md5sum (Linux) atau md5 (macOS)
if command -v md5sum &> /dev/null; then
    SESSION_ID=$(date +"%s" | md5sum | head -c 8)
elif command -v md5 &> /dev/null; then
    SESSION_ID=$(date +"%s" | md5 | head -c 8)
else
    SESSION_ID=$(date +"%s" | sha256sum | head -c 8)
fi

# =============================================================================
# FLAGS
# =============================================================================
QUICK_MODE=false
RUN_SINGLE=""

# Parse arguments
for arg in "$@"; do
    case $arg in
        --quick)
            QUICK_MODE=true
            shift
            ;;
        --scenario)
            RUN_SINGLE="$2"
            shift 2
            ;;
        --help)
            echo "Penggunaan: ./run-comparative.sh [options]"
            echo ""
            echo "Options:"
            echo "  --quick            Mode cepat (VU lebih sedikit, durasi lebih pendek)"
            echo "  --scenario <1-4>   Jalankan skenario tertentu saja"
            echo "  --help             Tampilkan bantuan ini"
            echo ""
            echo "Skenario:"
            echo "  1 = Hyperledger Only (Baseline)"
            echo "  2 = Hyperledger + IPFS"
            echo "  3 = Hyperledger + ZTA"
            echo "  4 = Hyperledger + ZTA + IPFS (Full Stack)"
            exit 0
            ;;
    esac
done

# =============================================================================
# FUNCTIONS
# =============================================================================

print_banner() {
    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}                                                              ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}  ${GREEN}K6 COMPARATIVE TEST - SEED CERTIFICATION SYSTEM${NC}        ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}  ${BLUE}Sesi: ${SESSION_ID} | ${SESSION_TIMESTAMP}${NC}                    ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}                                                              ${CYAN}║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_scenario_header() {
    local num=$1
    local name=$2
    local desc=$3

    echo ""
    echo -e "${MAGENTA}┌─────────────────────────────────────────────────────────┐${NC}"
    echo -e "${MAGENTA}│${NC}  ${YELLOW}SCENARIO ${num}: ${name}${NC}"
    echo -e "${MAGENTA}│${NC}  ${desc}"
    echo -e "${MAGENTA}└─────────────────────────────────────────────────────────┘${NC}"
    echo ""
}

check_dependencies() {
    if ! command -v k6 &> /dev/null; then
        echo -e "${RED}ERROR: K6 tidak terinstal${NC}"
        echo "Instalasi:"
        echo "  macOS: brew install k6"
        echo "  Linux: https://k6.io/docs/getting-started/installation/"
        exit 1
    fi

    echo -e "${GREEN}✓${NC} K6 $(k6 version)"
}

setup_directories() {
    mkdir -p "$REPORTS_DIR"
    mkdir -p "$COMPARATIVE_DIR"
    echo -e "${GREEN}✓${NC} Direktori laporan siap"
}

check_services() {
    local BASE_URL="https://gateway.jabarchain.me"

    echo ""
    echo -e "${BLUE}Memeriksa layanan...${NC}"

    # API Gateway
    if curl -s "$BASE_URL/api/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} API Gateway: ${BASE_URL} ${GREEN}ONLINE${NC}"
    else
        echo -e "${YELLOW}⚠${NC} API Gateway: ${BASE_URL} ${YELLOW}Tidak merespon${NC}"
        echo -e "${YELLOW}  Lanjutkan? (y/n)${NC}"
        read -r proceed
        if [ "$proceed" != "y" ]; then
            exit 1
        fi
    fi

    # Keycloak
    if curl -s "https://auth.jabarchain.me/health/ready" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Keycloak: ${GREEN}ONLINE${NC}"
    else
        echo -e "${YELLOW}⚠${NC} Keycloak: ${YELLOW}Tidak merespon${NC}"
    fi

    echo ""
}

# =============================================================================
# SCENARIO DEFINITIONS
# =============================================================================

run_scenario_1() {
    print_scenario_header "1" "HYPERLEDGER ONLY (BASELINE)" \
        "Keycloak Auth → Hyperledger Fabric Chaincode"

    local scenario_file="$SCENARIO_DIR/scenario-1-hl-baseline.js"
    local extra_args=""

    if [ ! -f "$scenario_file" ]; then
        echo -e "${RED}ERROR: File $scenario_file tidak ditemukan${NC}"
        return 1
    fi

    if [ "$QUICK_MODE" = true ]; then
        echo -e "${YELLOW}Mode cepat: 5 VU, 2 menit${NC}"
        k6 run "$scenario_file" \
            --vus 5 \
            --duration 2m \
            --tag scenario=hl_baseline \
           
    else
        k6 run "$scenario_file" \
            --tag scenario=hl_baseline \
           
    fi

    local exit_code=$?
    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}✓ Skenario 1 selesai${NC}"
    else
        echo -e "${RED}✗ Skenario 1 gagal (exit code: $exit_code)${NC}"
    fi

    return $exit_code
}

run_scenario_2() {
    print_scenario_header "2" "HYPERLEDGER + IPFS" \
        "Keycloak Auth → IPFS Cluster → Hyperledger Fabric"

    local scenario_file="$SCENARIO_DIR/scenario-2-hl-ipfs.js"
    local extra_args=""

    if [ ! -f "$scenario_file" ]; then
        echo -e "${RED}ERROR: File $scenario_file tidak ditemukan${NC}"
        return 1
    fi

    if [ "$QUICK_MODE" = true ]; then
        k6 run "$scenario_file" \
            --vus 3 \
            --duration 2m \
            --tag scenario=hl_ipfs \
           
    else
        k6 run "$scenario_file" \
            --tag scenario=hl_ipfs \
           
    fi

    local exit_code=$?
    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}✓ Skenario 2 selesai${NC}"
    else
        echo -e "${RED}✗ Skenario 2 gagal (exit code: $exit_code)${NC}"
    fi

    return $exit_code
}

run_scenario_3() {
    print_scenario_header "3" "HYPERLEDGER + ZTA" \
        "Keycloak Auth → ZTA Policy Engine → Hyperledger Fabric"

    local scenario_file="$SCENARIO_DIR/scenario-3-hl-zta.js"

    if [ ! -f "$scenario_file" ]; then
        echo -e "${RED}ERROR: File $scenario_file tidak ditemukan${NC}"
        return 1
    fi

    if [ "$QUICK_MODE" = true ]; then
        k6 run "$scenario_file" \
            --vus 5 \
            --duration 2m \
            --tag scenario=hl_zta \
           
    else
        k6 run "$scenario_file" \
            --tag scenario=hl_zta \
           
    fi

    local exit_code=$?
    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}✓ Skenario 3 selesai${NC}"
    else
        echo -e "${RED}✗ Skenario 3 gagal (exit code: $exit_code)${NC}"
    fi

    return $exit_code
}

run_scenario_4() {
    print_scenario_header "4" "HYPERLEDGER + ZTA + IPFS (FULL STACK)" \
        "Keycloak Auth → ZTA Policy Engine → IPFS Cluster → Hyperledger Fabric"

    local scenario_file="$SCENARIO_DIR/scenario-4-hl-zta-ipfs.js"

    if [ ! -f "$scenario_file" ]; then
        echo -e "${RED}ERROR: File $scenario_file tidak ditemukan${NC}"
        return 1
    fi

    if [ "$QUICK_MODE" = true ]; then
        k6 run "$scenario_file" \
            --vus 3 \
            --duration 2m \
            --tag scenario=hl_zta_ipfs \
           
    else
        k6 run "$scenario_file" \
            --tag scenario=hl_zta_ipfs \
           
    fi

    local exit_code=$?
    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}✓ Skenario 4 selesai${NC}"
    else
        echo -e "${RED}✗ Skenario 4 gagal (exit code: $exit_code)${NC}"
    fi

    return $exit_code
}

# =============================================================================
# GENERATE COMPARATIVE REPORT
# =============================================================================

generate_comparative_report() {
    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}  ${BLUE}GENERATING COMPARATIVE REPORT...${NC}                     ${CYAN}║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    local report_file="$COMPARATIVE_DIR/comparative-report-${SESSION_TIMESTAMP}.csv"
    local all_csv_files=(
        "$REPORTS_DIR/scenario-1-hl-baseline-"*.csv
        "$REPORTS_DIR/scenario-2-hl-ipfs-"*.csv
        "$REPORTS_DIR/scenario-3-hl-zta-"*.csv
        "$REPORTS_DIR/scenario-4-hl-zta-ipfs-"*.csv
    )

    # Header untuk laporan komparatif
    echo "Session_ID,Scenario,Timestamp,Total_Requests,Success,Failed,Error_Rate_Pct,Avg_Resp_Time_ms,Med_Resp_Time_ms,P95_Resp_Time_ms,P99_Resp_Time_ms,Min_Resp_Time_ms,Max_Resp_Time_ms,Throughput_RPS,Overhead_ms,Test_Duration_sec" > "$report_file"

    local scenario_count=0

    # Kumpulkan semua file CSV yang cocok dengan pattern
    for pattern in "${all_csv_files[@]}"; do
        # Skip jika pattern tidak match (nullglob)
        for csv_file in $pattern; do
            if [ -f "$csv_file" ]; then
                # Skip header (baris pertama) — ambil hanya data
                # Tambahkan Session_ID di kolom pertama
                tail -n +2 "$csv_file" | while IFS= read -r line; do
                    # Skip baris kosong
                    if [ -n "$line" ]; then
                        # Cari nama skenario dari nama file
                        local scenario_name=""
                        if [[ "$csv_file" == *"scenario-1-"* ]]; then
                            scenario_name="HL_BASELINE"
                        elif [[ "$csv_file" == *"scenario-2-"* ]]; then
                            scenario_name="HL_IPFS"
                        elif [[ "$csv_file" == *"scenario-3-"* ]]; then
                            scenario_name="HL_ZTA"
                        elif [[ "$csv_file" == *"scenario-4-"* ]]; then
                            scenario_name="HL_ZTA_IPFS"
                        fi
                        echo "${SESSION_ID},${scenario_name},${line}" >> "$report_file"
                    fi
                done
                scenario_count=$((scenario_count + 1))
                echo -e "${GREEN}✓${NC} Ditambahkan: $(basename "$csv_file")"
            fi
        done
    done

    if [ "$scenario_count" -gt 0 ] && [ -f "$report_file" ]; then
        echo ""
        echo -e "${GREEN}========================================${NC}"
        echo -e "${GREEN}  COMPARATIVE REPORT GENERATED${NC}"
        echo -e "${GREEN}========================================${NC}"
        echo ""
        echo -e "  ${BLUE}File:${NC}     $report_file"
        echo -e "  ${BLUE}Skenario:${NC}  $scenario_count dari 4"
        echo -e "  ${BLUE}Sesi ID:${NC}   $SESSION_ID"
        echo ""

        # Tampilkan summary table
        echo -e "${CYAN}┌─────────────────────────────────────────────────────────────────────────────────────┐${NC}"
        echo -e "${CYAN}│${NC}  ${YELLOW}COMPARATIVE SUMMARY${NC}                                                        ${CYAN}│${NC}"
        echo -e "${CYAN}├─────────────────────────────────────────────────────────────────────────────────────┤${NC}"
        printf "│  %-18s %-10s %-12s %-12s %-12s │\n" "Scenario" "Success" "Avg (ms)" "P95 (ms)" "RPS"
        echo -e "${CYAN}├─────────────────────────────────────────────────────────────────────────────────────┤${NC}"

        while IFS=',' read -r sid sc ts total success fail err_rate avg med p95 p99 min max rps ovh dur; do
            # Skip header
            if [ "$sc" = "Scenario" ] || [ -z "$sc" ]; then
                continue
            fi
            # Color code by scenario
            case "$sc" in
                "HL_BASELINE")  COLOR=$GREEN ;;
                "HL_IPFS")      COLOR=$YELLOW ;;
                "HL_ZTA")       COLOR=$BLUE ;;
                "HL_ZTA_IPFS")  COLOR=$MAGENTA ;;
                *)              COLOR=$NC ;;
            esac
            printf "│  ${COLOR}%-18s${NC} %-10s %-12s %-12s %-12s │\n" "$sc" "$success" "$avg" "$p95" "$rps"
        done < "$report_file"

        echo -e "${CYAN}└─────────────────────────────────────────────────────────────────────────────────────┘${NC}"
        echo ""
        echo -e "  ${GREEN}Buka laporan:${NC} open $report_file"
    else
        echo ""
        echo -e "${YELLOW}⚠ Tidak ada data CSV ditemukan.${NC}"
        echo -e "${YELLOW}  Pastikan skenario sudah dijalankan sebelumnya.${NC}"
    fi
}

# =============================================================================
# MAIN EXECUTION
# =============================================================================

main() {
    print_banner
    check_dependencies
    setup_directories
    check_services

    local start_time=$(date +%s)
    local EXIT_CODE=0

    # Snapshot environment info
    echo ""
    echo -e "${BLUE}Environment:${NC}"
    echo -e "  Working dir:    $(pwd)"
    echo -e "  K6 version:     $(k6 version 2>&1 | head -1)"
    echo -e "  Session ID:     $SESSION_ID"
    echo -e "  Mode:           $([ "$QUICK_MODE" = true ] && echo 'QUICK' || echo 'FULL')"
    echo ""

    # =========================================================================
    # RUN SELECTED SCENARIO(S)
    # =========================================================================
    if [ -n "$RUN_SINGLE" ]; then
        echo -e "${BLUE}Running single scenario: ${RUN_SINGLE}${NC}"
        case $RUN_SINGLE in
            1) run_scenario_1 || EXIT_CODE=$? ;;
            2) run_scenario_2 || EXIT_CODE=$? ;;
            3) run_scenario_3 || EXIT_CODE=$? ;;
            4) run_scenario_4 || EXIT_CODE=$? ;;
            *)
                echo -e "${RED}Invalid scenario: $RUN_SINGLE${NC}"
                echo "Pilihan: 1, 2, 3, atau 4"
                exit 1
                ;;
        esac
    else
        echo -e "${BLUE}Menjalankan semua skenario secara berurutan...${NC}"
        echo -e "${YELLOW}Estimasi total waktu: ~35 menit (mode FULL)${NC}"
        echo -e "${YELLOW}Atau: ~8 menit (mode --quick)${NC}"
        echo ""
        echo -e "${YELLOW}Tekan Ctrl+C untuk membatalkan kapan saja${NC}"
        echo ""

        # Jeda persiapan
        echo -e "${BLUE}Memulai dalam 5 detik...${NC}"
        sleep 2

        # Run scenario 1
        run_scenario_1 || EXIT_CODE=$?

        # Check if user wants to continue
        echo ""
        echo -e "${YELLOW}Lanjut ke Skenario 2? (y/n, default: y)${NC}"
        read -r proceed
        if [ "$proceed" = "n" ] || [ "$proceed" = "N" ]; then
            echo -e "${YELLOW}Dihentikan oleh user setelah Skenario 1${NC}"
            EXIT_CODE=1
            generate_comparative_report
            exit 1
        fi

        # Run scenario 2
        run_scenario_2 || EXIT_CODE=$?

        echo ""
        echo -e "${YELLOW}Lanjut ke Skenario 3? (y/n, default: y)${NC}"
        read -r proceed
        if [ "$proceed" = "n" ] || [ "$proceed" = "N" ]; then
            echo -e "${YELLOW}Dihentikan oleh user setelah Skenario 2${NC}"
            EXIT_CODE=1
            generate_comparative_report
            exit 1
        fi

        # Run scenario 3
        run_scenario_3 || EXIT_CODE=$?

        echo ""
        echo -e "${YELLOW}Lanjut ke Skenario 4 (Full Stack)? (y/n, default: y)${NC}"
        read -r proceed
        if [ "$proceed" = "n" ] || [ "$proceed" = "N" ]; then
            echo -e "${YELLOW}Dihentikan oleh user setelah Skenario 3${NC}"
            EXIT_CODE=1
            generate_comparative_report
            exit 1
        fi

        # Run scenario 4
        run_scenario_4 || EXIT_CODE=$?
    fi

    # =========================================================================
    # GENERATE COMPARATIVE REPORT
    # =========================================================================
    generate_comparative_report

    # =========================================================================
    # SUMMARY
    # =========================================================================
    local end_time=$(date +%s)
    local total_duration=$((end_time - start_time))
    local minutes=$((total_duration / 60))
    local seconds=$((total_duration % 60))

    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}  ${GREEN}COMPARATIVE TEST COMPLETE${NC}                                   ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}                                                              ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}  ${BLUE}Total Duration:${NC}  ${minutes}m ${seconds}s"
    echo -e "${CYAN}║${NC}  ${BLUE}Session ID:${NC}     ${SESSION_ID}"
    echo -e "${CYAN}║${NC}  ${BLUE}Laporan:${NC}        ${COMPARATIVE_DIR}/comparative-report-${SESSION_TIMESTAMP}.csv"
    echo -e "${CYAN}║${NC}                                                              ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}  ${YELLOW}Individual reports berada di: ${REPORTS_DIR}/${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    if [ $EXIT_CODE -eq 0 ]; then
        echo -e "${GREEN}Semua skenario selesai dengan sukses!${NC}"
    else
        echo -e "${YELLOW}Beberapa skenario mungkin gagal. Cek laporan untuk detail.${NC}"
    fi

    echo ""
    echo -e "${BLUE}Untuk melihat laporan komparatif:${NC}"
    echo "  cat ${COMPARATIVE_DIR}/comparative-report-${SESSION_TIMESTAMP}.csv"
    echo ""

    exit $EXIT_CODE
}

# Run main
main
