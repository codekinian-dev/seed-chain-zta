# Monitoring Stack untuk Seed Certification System

Stack monitoring komprehensif dengan Prometheus, Grafana, Loki, dan AlertManager untuk mendukung Zero Trust Architecture.

## 📦 Services

| Service           | Port | Purpose                      |
| ----------------- | ---- | ---------------------------- |
| **Prometheus**    | 9090 | Time-series metrics database |
| **Grafana**       | 3002 | Visualization & dashboards   |
| **Loki**          | 3100 | Log aggregation              |
| **Promtail**      | -    | Log shipper to Loki          |
| **AlertManager**  | 9093 | Alert routing & management   |
| **Node Exporter** | 9100 | System metrics               |
| **cAdvisor**      | 8080 | Container metrics            |

## 🚀 Quick Start

### 1. Start All Services

```bash
docker-compose up -d
```

### 2. Verify Services

```bash
# Check all services are running
docker-compose ps

# View logs
docker-compose logs -f
```

### 3. Access Dashboards

- **Grafana**: http://localhost:3001
  - Username: `admin`
  - Password: `admin123` (change in docker-compose.yml)
- **Prometheus**: http://localhost:9090
- **AlertManager**: http://localhost:9093

## 📊 Configuration Files

```
monitoring/
├── docker-compose.yml           # Main orchestration
├── prometheus.yml               # Prometheus scrape config
├── prometheus-rules.yml         # Alert rules
├── loki-config.yml             # Loki configuration
├── promtail-config.yml         # Promtail log shipping
├── alertmanager.yml            # Alert routing
└── grafana/
    ├── provisioning/           # Auto-provisioning
    └── dashboards/             # Dashboard JSONs
```

## 🔧 Configuration

### Prometheus Targets

Edit `prometheus.yml` to add new scrape targets:

```yaml
scrape_configs:
  - job_name: "my-service"
    static_configs:
      - targets: ["host.docker.internal:3000"]
    scrape_interval: 10s
```

### Alert Rules

Add custom alerts in `prometheus-rules.yml`:

```yaml
groups:
  - name: my_alerts
    rules:
      - alert: MyAlert
        expr: my_metric > 100
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Alert description"
```

### Alert Routing

Configure notifications in `alertmanager.yml`:

```yaml
receivers:
  - name: "my-receiver"
    webhook_configs:
      - url: "http://my-webhook-url"
```

## 📈 Default Dashboards

### 1. Zero Trust Overview

- Request metrics
- Authentication success/failure
- Policy violations
- Security events
- User activity

### 2. Security Dashboard

- Blocked IPs
- Suspicious activities
- Failed authentications
- Threat timeline
- Anomaly detection

### 3. Infrastructure

- CPU, Memory, Disk usage
- Network traffic
- Container metrics
- System health

### 4. Blockchain

- Transaction throughput
- Success/failure rate
- Average duration
- Chaincode usage

## 🔍 Query Examples

### Prometheus Queries

```promql
# Request rate per second
rate(http_requests_total[5m])

# Error percentage
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) * 100

# Failed authentication rate
rate(authentication_failures_total[5m])

# 95th percentile response time
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

### Loki Queries

```logql
# All error logs
{level="error"}

# Security events
{category="SECURITY"}

# Failed authentication
{category="AUTHENTICATION"} |= "FAILED"

# Specific user activity
{user_name="producer1"}

# Last hour critical events
{severity="CRITICAL"} [1h]
```

## 🚨 Alerts

### Critical Alerts

- SQL injection attempts
- Brute force attacks
- System down
- High error rate (>5%)

### High Severity

- Policy violation spike
- High blockchain failure rate
- Memory/CPU >85%
- Disk space <15%

### Medium Severity

- Off-hours access
- Multiple failed auth attempts
- Suspicious user agents

## 🔄 Maintenance

### Update Services

```bash
# Pull latest images
docker-compose pull

# Restart services
docker-compose down
docker-compose up -d
```

### Backup Data

```bash
# Backup Prometheus data
docker run --rm -v monitoring_prometheus-data:/data -v $(pwd):/backup \
  alpine tar czf /backup/prometheus-backup.tar.gz /data

# Backup Grafana data
docker run --rm -v monitoring_grafana-data:/data -v $(pwd):/backup \
  alpine tar czf /backup/grafana-backup.tar.gz /data
```

### Clean Up Old Data

```bash
# Remove old data (careful!)
docker-compose down -v

# Or keep data and just restart
docker-compose restart
```

## 🐛 Troubleshooting

### Prometheus not scraping

```bash
# Check targets in Prometheus UI
http://localhost:9090/targets

# Check network connectivity
docker-compose exec prometheus wget -O- http://host.docker.internal:3000/api/metrics
```

### Grafana shows no data

```bash
# Check data source configuration
# Grafana > Configuration > Data Sources

# Verify Prometheus URL: http://prometheus:9090
# Verify Loki URL: http://loki:3100
```

### Loki not receiving logs

```bash
# Check Promtail logs
docker-compose logs promtail

# Verify log paths in promtail-config.yml
# Ensure application logs directory is mounted
```

### Alerts not firing

```bash
# Check AlertManager logs
docker-compose logs alertmanager

# Verify rules in Prometheus
http://localhost:9090/rules

# Test webhook endpoint
curl -X POST http://your-webhook-url
```

## 📊 Data Retention

| Component  | Default Retention | Configuration                       |
| ---------- | ----------------- | ----------------------------------- |
| Prometheus | 30 days           | `--storage.tsdb.retention.time=30d` |
| Loki       | 7 days            | `retention_period: 168h`            |
| Grafana    | Unlimited         | N/A                                 |

Adjust in respective config files or docker-compose.yml.

## 🔒 Security

### Change Default Passwords

Edit `docker-compose.yml`:

```yaml
grafana:
  environment:
    - GF_SECURITY_ADMIN_PASSWORD=your-secure-password
```

### Restrict Access

Add authentication to services or use reverse proxy:

```yaml
# Example nginx config
location /prometheus {
auth_basic "Restricted";
auth_basic_user_file /etc/nginx/.htpasswd;
proxy_pass http://localhost:9090;
}
```

## 🌐 Production Considerations

1. **Use External Storage**: For production, use external storage for Prometheus (e.g., Thanos)
2. **HA Setup**: Run multiple instances of Prometheus and AlertManager
3. **Backup**: Regular backups of Grafana dashboards and Prometheus data
4. **Security**: Enable authentication on all services
5. **SSL/TLS**: Use HTTPS for all web interfaces
6. **Resource Limits**: Set appropriate memory and CPU limits
7. **Monitoring the Monitors**: Set up external health checks

## 📚 Additional Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Loki Documentation](https://grafana.com/docs/loki/)
- [AlertManager Documentation](https://prometheus.io/docs/alerting/latest/alertmanager/)

## 📞 Support

For issues or questions:

1. Check logs: `docker-compose logs [service-name]`
2. Review configuration files
3. Consult documentation
4. Contact system administrator
