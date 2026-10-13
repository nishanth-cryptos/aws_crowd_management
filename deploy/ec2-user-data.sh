#!/bin/bash
# EC2 "User data" script (Amazon Linux 2023). Paste into Advanced details -> User data.
# REPO_URL is the GitHub repository EC2 clones on first boot.
REPO_URL="https://github.com/nishanth-cryptos/aws_crowd_management.git"

set -eux
exec > /var/log/crowd-deploy.log 2>&1

dnf install -y docker git
systemctl enable --now docker
usermod -aG docker ec2-user

# Docker Compose plugin
mkdir -p /usr/local/lib/docker/cli-plugins
curl -fSL "https://github.com/docker/compose/releases/download/v2.29.7/docker-compose-linux-$(uname -m)" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# 2 GB swap so the React build doesn't run out of memory on a 1 GB free-tier instance
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile swap swap defaults 0 0' >> /etc/fstab
fi

git clone "$REPO_URL" /opt/crowd
cd /opt/crowd
docker build -t crowd-app:latest .
docker compose -f docker-compose.aws.yml up -d
echo "DEPLOY COMPLETE"
