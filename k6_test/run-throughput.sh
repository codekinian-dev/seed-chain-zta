#!/bin/bash
#
# =============================================================================
# THROUGHPUT CEILING TEST RUNNER
# =============================================================================
# Menjalankan constant-arrival-rate pada 4 skenario dengan rate bertahap:
#   2, 5, 10, 20, 30 req/s
#
# Output:
#   reports/tp-[1-4]-[scenario]-rate-[N]-[timestamp].csv
#   reports/tp-comparative-[timestamp].csv
#
# Penggunaan:
#   ./run-throughput.sh            # Full: semua rate 2,5,10,20,30
#   ./run-throughput.sh --quick    # Hanya rate 2,5,10
#   ./run-throughput.sh --scenario 1 --rate 5  # Single test
# =============================================================================

set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'

SCENARIO_DIR=$(dirname "$0")
REPORTS_DIR="$SCENARIO_DIR/reports"
SESSION_TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

QUICK_MODE=false
RUN_SINGLE=""
SINGLE_RATE=""

for arg in "$@"; do
    case $arg in
        --quick) QUICK_MODE=true; shift ;;
        --scenario) RUN_SINGLE="$2"; shift 2 ;;
        --rate) SINGLE_RATE="$2"; shift 2 ;;
        --help)
            echo "Usage: ./run-throughput.sh [options]"
            echo "  --quick              Only rates 2,5,10"
            echo "  --scenario <1-4>     Single scenario"
            echo "  --rate <N>           Single rate (req/s)"
            exit 0
            ;;
    esac
done

# =============================================================================
# DEFINISI SKENARIO
# =============================================================================
declare -A SCENARIO_NAMES=(
    [1]="TP-1 HL BASELINE"
    [2]="TP-2 HL+IPFS"
    [3]="TP-3 HL+ZTA"
    [4]="TP-4 HL+ZTA+IPFS"
)
declare -A SCENARIO_FILES=(
    [1]="tp-1-hl-baseline.js"
    [2]="tp-2-hl-ipfs.js"
    [3]="tp-3-hl-zta.js"
    [4]="tp-4-hl-zta-ipfs.js"
)

if [ "$QUICK_MODE" = true ]; then
    RATES=(2 5 10)
else
    RATES=(2 5 10 20 30)
fi

# =============================================================================
# FUNGSI
# =============================================================================
check_deps() {
    if ! command -v k6 &>/dev/null; then echo -e "${RED}K6 not installed${NC}"; exit 1; fi
    mkdir -p "$REPORTS_DIR"
    echo -e "${GREEN}✓${NC} K6 $(k6 version | head -1)"
}

print_banner() {
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}  THROUGHPUT CEILING — CONSTANT ARRIVAL RATE TEST     ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}  ${BLUE}Session: ${SESSION_TIMESTAMP}${NC}                          ${CYAN}║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════╝${NC}"
}

run_scenario_at_rate() {
    local scenario_num=$1
    local rate=$2
    local name=${SCENARIO_NAMES[$scenario_num]}
    local file=${SCENARIO_FILES[$scenario_num]}
    local fpath="$SCENARIO_DIR/$file"

    if [ ! -f "$fpath" ]; then
        echo -e "${RED}✗ File not found: $fpath${NC}"
        return 1
    fi

    echo ""
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}  ${name}${NC}"
    echo -e "${YELLOW}  Target rate: ${rate} req/s | Duration: 3m${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    k6 run "$fpath" \
        --env RATE=$rate \
        --tag scenario=tp_${scenario_num} \
        --tag rate=${rate}

    local exit_code=$?
    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}✓${NC} Complete"
    else
        echo -e "${RED}✗${NC} Exit code: $exit_code"
    fi
    return $exit_code
}

generate_comparative_report() {
    echo ""
    echo -e "${CYAN}Generating comparative report...${NC}"

    local report_file="$REPORTS_DIR/tp-comparative-${SESSION_TIMESTAMP}.csv"
    echo "Session,Scenario,Target_Rate,Actual_RPS,Avg_Resp_Time_ms,P95_Resp_Time_ms,P99_Resp_Time_ms,Min_Resp_Time_ms,Max_Resp_Time_ms,Error_Rate,Total_Requests" > "$report_file"

    local found=0
    for f in "$REPORTS_DIR"/tp-*-rate-*.csv; do
        [ -f "$f" ] || continue
        tail -n +2 "$f" | while IFS= read -r line; do
            [ -n "$line" ] && echo "${SESSION_TIMESTAMP},${line}" >> "$report_file"
        done
        found=$((found + 1))
        echo -e "${GREEN}✓${NC} $(basename "$f")"
    done

    if [ $found -gt 0 ]; then
        echo ""
        echo -e "${GREEN}========================================${NC}"
        echo -e "${GREEN}  COMPARATIVE REPORT${NC}"
        echo -e "${GREEN}========================================${NC}"
        echo -e "  ${BLUE}File:${NC}     $report_file"
        echo -e "  ${BLUE}Runs:${NC}      $found"
        echo ""

        # Summary table
        printf "%-20s %-10s %-12s %-12s %-12s\n" "Scenario" "Rate" "RPS" "P95(ms)" "ErrRate"
        echo "──────────────────────────────────────────────────────────"
        while IFS=',' read -r ses sc rate actual_rps avg p95 p99 min max err total; do
            [ "$sc" = "Scenario" ] || [ -z "$sc" ] && continue
            printf "%-20s %-10s %-12s %-12s %-12s\n" "$sc" "$rate" "$actual_rps" "$p95" "$err"
        done < "$report_file"
        echo ""
    else
        echo -e "${YELLOW}No data files found.${NC}"
    fi
}

# =============================================================================
# MAIN
# =============================================================================
print_banner
check_deps

start_time=$(date +%s)

if [ -n "$RUN_SINGLE" ]; then
    # Single scenario
    if [ -n "$SINGLE_RATE" ]; then
        run_scenario_at_rate "$RUN_SINGLE" "$SINGLE_RATE"
    else
        for rate in "${RATES[@]}"; do
            sleep 2
            run_scenario_at_rate "$RUN_SINGLE" "$rate"
        done
    fi
else
    # All scenarios × all rates
    total=$(( 4 * ${#RATES[@]} ))
    current=0

    for scenario in 1 2 3 4; do
        for rate in "${RATES[@]}"; do
            current=$((current + 1))
            echo ""
            echo -e "${BLUE}[${current}/${total}]${NC}"
            sleep 2
            run_scenario_at_rate "$scenario" "$rate"
        done
    done
fi

end_time=$(date +%s)
duration=$((end_time - start_time))
echo ""
echo -e "${GREEN}======================${NC}"
echo -e "${GREEN}  ALL TESTS COMPLETE${NC}"
echo -e "${GREEN}======================${NC}"
echo -e "Duration: $((duration / 60))m $((duration % 60))s"
echo ""

generate_comparative_report
