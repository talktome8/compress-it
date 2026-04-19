# 🚀 Deploy to Render - 50MB File Support!

## Why Render Instead of Vercel?

| Feature | Vercel | Render |
|---------|--------|--------|
| **File Size Limit** | ❌ 4.5MB | ✅ **50MB+** |
| | **Request too large** | **Full support** |
| **Free Tier** | ✅ Yes | ✅ Yes |
| **Auto Deploy** | ✅ GitHub | ✅ GitHub |
| **Speed** | ⚡ Edge network | ⚡ Fast |
| **Best For** | Static sites | **Backend/File processing** |

## 🎯 Quick Deploy (5 Minutes)

### Step 1: Push Latest Code
```bash
git add -A
git commit -m "Add Render support with 50MB file limits"
git push origin main
```

### Step 2: Create Render Account
1. Go to https://render.com
2. Click **"Get Started"**
3. Sign up with **GitHub** (easiest)

### Step 3: Deploy
1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub account (if first time)
3. Select **"compress-it"** repository
4. Render auto-detects settings from `render.yaml`:
   - ✅ Name: compress-it
   - ✅ Build: `npm install`
   - ✅ Start: `npm start`
   - ✅ Environment: Node
5. Click **"Create Web Service"**

### Step 4: Wait for Deployment
- Initial deploy: 2-5 minutes
- Watch build logs in dashboard
- When done, you'll see: **"Your service is live"** ✅

### Step 5: Get Your URL
Render gives you a URL like:
```
https://compress-it-xxxx.onrender.com
```

Or add a custom domain:
- Click **"Settings"** → **"Custom Domain"**
- Add: `compress-it.raztom.com`
- Update DNS (Render provides instructions)

## ✅ What You Get on Render

### Automatic Features:
- ✅ **50MB file uploads** (vs 4MB on Vercel)
- ✅ **Auto-deploy** from GitHub (push → deploy)
- ✅ **Free SSL** certificate
- ✅ **Health checks** (`/api/health`)
- ✅ **Zero-downtime** deploys
- ✅ **Logs & monitoring**

### Your App Will Show:
```javascript
Compress-It initialized v2.1.0
Platform: Render
Max file size: 50MB  // ← Automatically detected!
```

## 🔧 Configuration (Already Done!)

The `render.yaml` file is already configured:
```yaml
services:
  - type: web
    name: compress-it
    env: node
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - MAX_FILE_SIZE: 52428800  # 50MB
```

## 🎨 Smart Platform Detection

The app automatically detects which platform it's on:

**On Vercel:**
- Shows "Max 4MB per file"
- Blocks files > 4MB

**On Render:**
- Shows "Max 50MB per file"
- Blocks files > 50MB

**Code does this automatically!** No changes needed.

## 📊 Comparison

### Current (Vercel):
```
❌ 413 errors for files > 4MB
❌ User frustration
❌ Limited functionality
```

### After Render:
```
✅ Files up to 50MB work perfectly
✅ Happy users
✅ Full functionality
```

## 🌐 DNS Setup (Optional - Custom Domain)

If you want `compress-it.raztom.com` on Render:

### Option 1: Move Entire Domain
1. In Render dashboard → Custom Domain
2. Add: `compress-it.raztom.com`
3. Get Render's DNS settings
4. Update your DNS provider

### Option 2: Subdomain
1. Add: `app.compress-it.raztom.com`
2. Point CNAME to Render's URL
3. Keep Vercel on main domain if you want

## 💰 Cost

**Free Tier:**
- ✅ 750 hours/month (enough for 24/7)
- ✅ Auto-spin down after 15 min inactivity
- ✅ Spins up in <1 second on first request
- ❌ Cold start delay (fixable with paid tier)

**Paid Tier ($7/month):**
- ✅ No cold starts
- ✅ Always on
- ✅ Faster builds

## 🔄 Keep Both (Smart Approach)

You can run on BOTH platforms:

**Vercel (compress-it.raztom.com):**
- Free tier
- Edge network (fastest)
- For users with small files (<4MB)

**Render (app.compress-it.raztom.com):**
- Free tier
- 50MB support
- For users with large files

Add a banner on Vercel:
```
"Need files > 4MB? Use app.compress-it.raztom.com"
```

## 🚨 Important Notes

### Free Tier Limitations:
**Render Free:**
- Spins down after 15 min inactivity
- First request after sleep = ~10 sec cold start
- All subsequent requests = instant

**Solution:** Add this to your site:
```javascript
// Keep alive ping (optional)
setInterval(() => {
  fetch('/api/health');
}, 10 * 60 * 1000); // Every 10 minutes
```

## ✅ Deployment Checklist

- [ ] Push latest code to GitHub
- [ ] Create Render account
- [ ] Connect GitHub
- [ ] Create new Web Service
- [ ] Select compress-it repo
- [ ] Wait for build (2-5 min)
- [ ] Test with file > 4MB
- [ ] ✅ Success!

## 🧪 Testing After Deployment

1. **Visit Render URL**
   ```
   https://compress-it-xxxx.onrender.com
   ```

2. **Open Console (F12)**
   Should see:
   ```
   Compress-It initialized v2.1.0
   Platform: Render
   Max file size: 50MB
   ```

3. **Upload Large File**
   - Try 10MB image
   - Should work perfectly!
   - No 413 errors!

## 🎯 Next Steps

### Immediate:
1. ✅ Deploy to Render (5 min)
2. ✅ Test with large files
3. ✅ Update documentation

### Future:
- Add custom domain
- Upgrade to paid tier (no cold starts)
- Add monitoring/analytics
- CDN for static assets

## 🆘 Troubleshooting

### Build Fails
- Check build logs in Render dashboard
- Usually: missing dependencies
- Solution: `npm install` in render.yaml

### Still 4MB Limit
- Hard refresh browser (Ctrl+Shift+R)
- Check console for "Platform: Render"
- Verify deployment completed

### Slow First Load
- Free tier cold starts
- Upgrade to $7/month for always-on
- Or add keep-alive ping

## 📚 Resources

- Render Docs: https://render.com/docs
- Deploy Guide: https://render.com/docs/deploy-node-express-app
- Custom Domains: https://render.com/docs/custom-domains

---

**Ready to deploy?** Follow the steps above!

**Result:** 50MB file support in 5 minutes! 🚀
