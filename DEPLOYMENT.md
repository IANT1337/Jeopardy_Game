# Cloud Deployment Guide for Jeopardy Game

## Option 1: Railway (Recommended - Easiest)

### Step 1: Prepare Your Code
1. Push your code to a GitHub repository (if not already done)
2. Make sure all files are committed, including:
   - `jeopardy_questions.csv` (your game questions)
   - All files in the `public/` folder
   - `package.json` with proper start script

### Step 2: Deploy to Railway
1. Go to [railway.app](https://railway.app)
2. Sign up/login with your GitHub account
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your Jeopardy game repository
5. Railway will automatically:
   - Detect it's a Node.js application
   - Install dependencies with `npm install`
   - Start the server with `npm start`

### Step 3: Configure Environment Variables
1. In Railway dashboard, go to your project
2. Click on "Variables" tab
3. Add these environment variables:
   - `HOST_PASSWORD`: Set a secure password for hosts
   - `PORT`: Railway will set this automatically
   - `NODE_ENV`: Set to "production"

### Step 4: Access Your Game
1. Railway will provide a public URL (like `https://your-app.railway.app`)
2. Share this URL with players instead of your local IP
3. Players access: `https://your-app.railway.app`
4. Host interface: `https://your-app.railway.app/host`
5. Contestant interface: `https://your-app.railway.app/contestant`

---

## Option 2: Heroku

### Step 1: Install Heroku CLI
Download from [devcenter.heroku.com/articles/heroku-cli](https://devcenter.heroku.com/articles/heroku-cli)

### Step 2: Create Procfile
Already handled - your `package.json` start script is sufficient.

### Step 3: Deploy
```bash
# Login to Heroku
heroku login

# Create a new Heroku app
heroku create your-jeopardy-game-name

# Set environment variables
heroku config:set HOST_PASSWORD=your-secure-password
heroku config:set NODE_ENV=production

# Deploy
git add .
git commit -m "Prepare for Heroku deployment"
git push heroku main

# Open your app
heroku open
```

---

## Option 3: Render

### Step 1: Connect Repository
1. Go to [render.com](https://render.com)
2. Sign up and connect your GitHub account
3. Click "New +" → "Web Service"
4. Connect your repository

### Step 2: Configure Service
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Environment Variables**:
  - `HOST_PASSWORD`: your-secure-password
  - `NODE_ENV`: production

### Step 3: Deploy
Render will automatically deploy and provide a public URL.

---

## Important Changes for Cloud Hosting

### 1. Environment Variables
Your app is already configured to use environment variables:
- `process.env.PORT` for the port (cloud platforms set this)
- `process.env.HOST_PASSWORD` for security
- `process.env.HOST` for binding (set to '0.0.0.0' for cloud)

### 2. File Storage
Your questions are stored in `jeopardy_questions.csv` which will work fine in the cloud.

### 3. Session Storage
Your app uses in-memory storage which works for single-instance deployments. For high availability, consider using Redis for session storage in the future.

---

## Post-Deployment Steps

### 1. Test Your Deployment
1. Visit your app's URL
2. Create a host session with your password
3. Join as a contestant from another device/browser
4. Test all game functionality

### 2. Share with Players
Instead of sharing your local IP, share the cloud URL:
- **Landing page**: `https://your-app.railway.app` (or your platform's URL)
- Players can join as contestants using the session ID system

### 3. Monitor Your App
Most platforms provide:
- Logs to debug issues
- Metrics to monitor performance
- Automatic scaling options

---

## Security Considerations

### 1. Strong Passwords
Set a strong `HOST_PASSWORD` environment variable.

### 2. HTTPS
Cloud platforms provide automatic HTTPS, which is more secure than local HTTP.

### 3. Session Management
Your app already has session timeouts and isolation features.

---

## Cost Considerations

### Free Tiers:
- **Railway**: $5/month in credits (generous for small apps)
- **Render**: Free tier with some limitations
- **Heroku**: Free tier discontinued, but hobby tier is affordable

### Paid Options:
- Start with free/low-cost options
- Upgrade as your usage grows
- Most hosting costs $5-20/month for small to medium apps

---

## Need Help?

If you encounter issues:
1. Check the platform's logs for error messages
2. Ensure all environment variables are set correctly
3. Verify your `jeopardy_questions.csv` file is included in your repository
4. Test locally first with `npm start` to ensure everything works

Choose Railway for the easiest deployment experience!
