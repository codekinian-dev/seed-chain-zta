#!/bin/bash
#
# =============================================================================
# THROUGHPUT CEILING — QUERY PUBLIC
# =============================================================================
# Mengukur throughput ceiling pada endpoint publik:
#   GET /api/v1/documents/verify-certificate
#
# Rate bertahap: 5, 10, 20, 40, 60, 80 req/s
# Durasi per test: 2 menit
#
# Output:
#   reports/tp-query-1-public-rate-{N}-*.csv
#   reports/tp-query-comparative-*.csv
#
# Penggunaan:
#   ./run-throughput-query.sh
#   ./run-throughput-query.sh --quick   # hanya 5,10,20
# =============================================================================

set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'

DIR=$(dirname "$0")
REPORTS="$DIR/reports"
TS=$(date +"%Y%m%d_%H%M%S")
QUICK=false

for arg in "$@"; do
    [ "$arg" = "--quick" ] && QUICK=true
    [ "$arg" = "--help" ] && {
        echo "Usage: ./run-throughput-query.sh [--quick]"
        echo "  --quick   Hanya rate 5, 10, 20"
        exit 0
    }
done

check_deps() {
    command -v k6 &>/dev/null || { echo -e "${RED}K6 not installed${NC}"; exit 1; }
    mkdir -p "$REPORTS"
    echo -e "${GREEN}✓${NC} K6 $(k6 version | head -1)"
}

RATES=(5 10 20 40 60 80)
$QUICK && RATES=(5 10 20)

echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}  THROUGHPUT CEILING — QUERY PUBLIC                    ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}  ${BLUE}Session: ${TS}${NC}                              ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}  Rates:  ${RATES[*]} req/s                            ${CYAN}║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

check_deps

start=$(date +%s)

for rate in "${RATES[@]}"; do
    echo ""
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}  RATE: ${rate} req/s | Duration: 2m${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    k6 run "$DIR/tp-query-1-public.js" \
        --env RATE=$rate \
        --tag test=throughput_query \
        --tag rate=${rate}

    ec=$?
    if [ $ec -eq 0 ]; then
        echo -e "${GREEN}✓${NC} Rate ${rate} req/s selesai"
    else
        echo -e "${RED}✗${NC} Rate ${rate} req/s gagal (exit $ec)"
    fi

    sleep 2
done

# =============================================================================
# LAPORAN KOMPARATIF
# =============================================================================
report="$REPORTS/tp-query-comparative-${TS}.csv"
echo "Session,Target_Rate,Actual_RPS,Avg_Resp_Time_ms,P95_Resp_Time_ms,P99_Resp_Time_ms,Min_Resp_Time_ms,Max_Resp_Time_ms,Error_Rate,Total_Requests,Test_Duration_sec" > "$report"

found=0
for f in "$REPORTS"/tp-query-1-public-rate-*.csv; do
    [ -f "$f" ] || continue
    tail -n +2 "$f" | while IFS= read -r line; do
        [ -n "$line" ] && echo "${TS},${line}" >> "$report"
    done
    found=$((found + 1))
done

end=$(date +%s)
dur=$((end - start))

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  QUERY THROUGHPUT TEST — SELESAI${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "  ${BLUE}Durasi:${NC}    $((dur / 60))m $((dur % 60))s"
echo -e "  ${BLUE}Rates:${NC}     ${RATES[*]} req/s"
echo -e "  ${BLUE}Laporan:${NC}   $report"
echo ""

if [ $found -gt 0 ]; then
    echo -e "${CYAN}RINGKASAN${NC}"
    echo "──────────────────────────────────────────────────────────────"
    printf "%-10s %-10s %-15s %-10s %-10s\n" "Rate" "RPS" "Avg(ms)" "P95(ms)" "ErrRate"
    echo "──────────────────────────────────────────────────────────────"
    while IFS=',' read -r ses rate actual avg p95 p99 min max err total dur; do
        [ "$rate" = "Target_Rate" ] && continue
        printf "%-10s %-10s %-15s %-10s %-10s\n" "$rate" "$actual" "$avg" "$p95" "$err"
    done < "$report"
    echo ""
fi

echo -e "${GREEN}Lihat laporan lengkap: cat ${report}${NC}"
echo ""
