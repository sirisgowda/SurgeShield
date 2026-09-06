#!/usr/bin/env bash
# Run this ONCE on your vanilla Lubuntu VM to install all required tools
set -e

echo "============================================================"
echo "       SurgeShield Lubuntu VM Setup Script                  "
echo "============================================================"

# 1. Update package lists
echo ""
echo "==> [1/5] Updating apt packages..."
sudo apt-get update -y

# 2. Install Git, curl, unzip (essentials)
echo ""
echo "==> [2/5] Installing essentials (git, curl, unzip, ca-certificates)..."
sudo apt-get install -y git curl unzip ca-certificates gnupg lsb-release

# 3. Install Docker
echo ""
echo "==> [3/5] Installing Docker..."
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin

# Add current user to docker group so sudo isn't needed
sudo usermod -aG docker "$USER"
echo "NOTE: Docker installed. You may need to logout and login again for group changes to take effect."
echo "      If docker commands fail, run: newgrp docker"

# 4. Install AWS CLI v2
echo ""
echo "==> [4/5] Installing AWS CLI v2..."
curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscliv2.zip
unzip -q /tmp/awscliv2.zip -d /tmp/
sudo /tmp/aws/install --update
rm -rf /tmp/awscliv2.zip /tmp/aws

# 5. Configure AWS Credentials
echo ""
echo "==> [5/5] Setup complete! Now configure AWS credentials..."
echo ""
echo "Run the following command and enter your credentials:"
echo ""
echo "  aws configure"
echo ""
echo "  AWS Access Key ID: <your access key>"
echo "  AWS Secret Access Key: <your secret key>"
echo "  Default region name: ap-south-1"
echo "  Default output format: json"
echo ""
echo "Then verify with:"
echo "  aws sts get-caller-identity"
echo ""
echo "============================================================"
echo "         ALL TOOLS INSTALLED SUCCESSFULLY!                   "
echo "============================================================"
echo ""
echo "VERSIONS INSTALLED:"
docker --version
aws --version
echo ""
echo "NEXT STEP: Run the push script:"
echo "  chmod +x scripts/push-to-ecr-vm.sh"
echo "  ./scripts/push-to-ecr-vm.sh"
