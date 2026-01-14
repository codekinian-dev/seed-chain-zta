# VPS Quick Reference Card

## 🚨 Emergency Commands

```bash
# Container terus restart? Lihat kenapa:
docker logs seed-api-gateway-prod --tail 100

# Stop sementara untuk debug:
docker-compose -f docker-compose.prod.yml down

# Start tanpa detach (lihat logs langsung):
docker-compose -f docker-compose.prod.yml up

# Restart dengan rebuild:
docker-compose -f docker-compose.prod.yml up -d --build
```

---

## 📊 Monitoring

```bash
# Check status
docker-compose -f docker-compose.prod.yml ps

# View logs
./scripts/logs.sh

# Follow logs real-time
docker logs -f seed-api-gateway-prod

# Monitor resources
docker stats

# Health check
curl http://localhost:3001/api/health/liveness
```

---

## 🔧 Diagnostic Tools

```bash
# Full diagnosis
./scripts/vps-diagnose.sh

# Monitor health (continuous)
./scripts/monitor.sh

# Check inside container
docker exec -it seed-api-gateway-prod sh
```

---

## 🐛 Common Issues

### Container exits immediately

**Check logs first:**
```bash
docker logs seed-api-gateway-prod
```

**Likely causes:**
1. Keycloak not reachable → Check `KEYCLOAK_URL` in `.env.docker.local`
2. Fabric network down → Check connection-profile.json
3. Missing wallet → Check `ls -la wallet/`
4. Wrong permissions → Run `chmod -R 755 wallet crypto-config`

### Container keeps restarting

**Check restart policy:**
```bash
docker inspect seed-api-gateway-prod | grep -A 5 RestartPolicy
```

**Fix:** Already set to `unless-stopped` in docker-compose.prod.yml

### Port already in use

```bash
sudo lsof -i :3001
# Kill the process using port
sudo kill -9 <PID>
```

### host.docker.internal not working

**Fix:** Already added in docker-compose.prod.yml:
```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

---

## 🔐 Security

```bash
# Check secrets are set
grep -v "^#" .env.docker.local | grep SECRET

# Generate new secrets
openssl rand -hex 32    # For KEYCLOAK_CLIENT_SECRET
openssl rand -base64 32 # For SESSION_SECRET
```

---

## 📦 Deployment Workflow

```bash
# 1. Setup (first time only)
./scripts/vps-setup.sh

# 2. Check everything is configured
./scripts/vps-diagnose.sh

# 3. Deploy
docker-compose -f docker-compose.prod.yml up -d --build

# 4. Monitor
docker-compose -f docker-compose.prod.yml logs -f

# 5. Test
curl http://localhost:3001/api/health/liveness
```

---

## 🧹 Maintenance

```bash
# Update code
git pull
docker-compose -f docker-compose.prod.yml up -d --build

# Clean old images
docker system prune -a

# Backup
tar -czf backup-$(date +%Y%m%d).tar.gz wallet/ crypto-config/ .env.docker.local

# View disk usage
docker system df
```

---

## 📝 Environment Variables Checklist

In `.env.docker.local`, verify:
- [ ] `KEYCLOAK_URL` = http://YOUR_VPS_IP:8080 (NOT localhost)
- [ ] `KEYCLOAK_CLIENT_SECRET` = actual secret (NOT placeholder)
- [ ] `SESSION_SECRET` = random string (NOT placeholder)
- [ ] `IPFS_HOST` = YOUR_VPS_IP (NOT localhost)
- [ ] `FABRIC_AS_LOCALHOST` = false
- [ ] `REDIS_HOST` = redis (service name)

---

## 🌐 Network Troubleshooting

```bash
# Test from host to services
curl http://localhost:8080  # Keycloak
curl http://localhost:9094  # IPFS
curl http://localhost:3001  # API Gateway

# Test from container
docker exec seed-api-gateway-prod wget -O- http://host.docker.internal:8080
docker exec seed-api-gateway-prod ping -c 3 redis

# Check Docker networks
docker network ls
docker network inspect seed-network
```

---

## 📚 Full Documentation

- **Detailed guide:** [docs/VPS_DEPLOYMENT.md](docs/VPS_DEPLOYMENT.md)
- **Troubleshooting:** [TROUBLESHOOTING_VPS.md](TROUBLESHOOTING_VPS.md)
- **Docker guide:** [docs/DOCKER_GUIDE.md](docs/DOCKER_GUIDE.md)

---

## 💡 Pro Tips

1. **Always check logs first** when container fails
2. **Use scripts/** helper tools for common tasks
3. **Monitor resources** with `docker stats`
4. **Backup wallet/** and **.env.docker.local** regularly
5. **Set up nginx** reverse proxy for production
6. **Enable firewall** but allow necessary ports
7. **Use SSL/TLS** in production (Let's Encrypt)

---

## 🆘 Still Not Working?

Generate debug report:
```bash
./scripts/vps-diagnose.sh
docker logs seed-api-gateway-prod > debug.log
docker-compose -f docker-compose.prod.yml config > config.log
```

Check:
1. Are all prerequisites running? (Keycloak, IPFS, Fabric)
2. Can you access them from VPS? (`curl` test)
3. Are firewall rules correct?
4. Is disk space sufficient? (`df -h`)
5. Is memory sufficient? (`free -h`)
