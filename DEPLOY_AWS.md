# Deploying to AWS (EC2 + Docker)

The whole app runs on **one EC2 instance** with two Docker containers:

| Container | What it does |
|-----------|--------------|
| `app`     | Node/Express + Socket.IO backend, also serves the built React dashboard on port 80 |
| `mongodb` | MongoDB 6, data kept in a Docker volume |

Open `http://<EC2-public-IP>/` to see the dashboard, API (`/api/...`) and live socket updates, all on the same URL.

---

## 1. Push the code to GitHub

```bash
git init
git add .
git commit -m "Real-time crowd management system"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

Keep the repo **public** so EC2 can clone it without credentials.

## 2. Launch the EC2 instance (AWS Console)

1. Sign in to the AWS Console, pick a region (top right, e.g. **Asia Pacific (Mumbai) ap-south-1**), then open **EC2** and click **Launch instance**.
2. **Name:** `crowd-management`
3. **AMI:** *Amazon Linux 2023* (Free tier eligible)
4. **Instance type:** `t2.micro` or `t3.micro` (Free tier eligible)
5. **Key pair:** *Create new key pair*, name it `crowd-key`, type RSA, format `.pem`. It downloads; keep it safe.
6. **Network settings → Edit:**
   - ✅ Allow SSH traffic from **My IP**
   - ✅ Allow HTTP traffic from the internet
7. **Configure storage:** 16 GiB gp3
8. **Advanced details → User data:** paste the full contents of [`deploy/ec2-user-data.sh`](deploy/ec2-user-data.sh),
   **after changing `REPO_URL` to your GitHub repo URL**.
9. Click **Launch instance**.

The instance installs Docker, clones the repo, builds the image, and starts the containers on its own.
On a micro instance this takes **about 10–15 minutes** (installing packages and building React are the slow parts).

## 3. Open the site

EC2 → Instances → select `crowd-management` → copy **Public IPv4 address** → open
`http://<that-ip>/` (use **http**, not https).

Health check: `http://<that-ip>/health`

## 4. Check progress or troubleshoot (optional)

EC2 → select the instance → **Connect** → **EC2 Instance Connect** → **Connect** (opens a browser terminal), then:

```bash
sudo tail -f /var/log/crowd-deploy.log      # wait for "DEPLOY COMPLETE"
sudo docker ps                              # both containers should be "Up"
sudo docker logs -f crowd-app-1 2>/dev/null || sudo docker compose -f /opt/crowd/docker-compose.aws.yml logs -f app
```

## 5. Deploy updates later

Push to GitHub, then in the instance terminal:

```bash
cd /opt/crowd
sudo git pull
sudo docker build -t crowd-app:latest .
sudo docker compose -f docker-compose.aws.yml up -d
```

## 6. Avoid charges when done

EC2 → Instances → select → **Instance state → Stop** (keeps everything, can be started again; the public IP changes)
or **Terminate** (deletes it). Free tier covers 750 hours/month of a micro instance for eligible accounts.
