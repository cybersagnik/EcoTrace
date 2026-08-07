# EcoTrace Frontend - Git Upload Instructions

This guide provides step-by-step instructions to upload your project to Git (e.g., GitHub, GitLab, or Bitbucket).

---

## Step 1: Install Git (If not already installed)

If Git is not installed on your system:
1. Download Git from [git-scm.com/download/win](https://git-scm.com/download/win).
2. Run the installer (you can accept default settings).
3. Restart your terminal / command prompt after installation.

*Or via PowerShell (Winget):*
```powershell
winget install --id Git.Git -e --source winget
```

---

## Step 2: Automatic Upload (Using Script)

Double-click or run [upload_to_git.bat](file:///e:/project/EcoTrace/extract%20all/ecotrace-frontend/upload_to_git.bat) or run [upload_to_git.ps1](file:///e:/project/EcoTrace/extract%20all/ecotrace-frontend/upload_to_git.ps1) in PowerShell.

1. Double-click `upload_to_git.bat`.
2. Enter your repository URL (e.g. `https://github.com/your-username/ecotrace-frontend.git`).
3. The script will initialize Git, commit all clean source files, add your remote repository, and push the code.

---

## Step 3: Manual Upload (Commands)

If you prefer to run the commands manually:

```bash
# 1. Initialize Git repository
git init

# 2. Rename default branch to main
git branch -M main

# 3. Add all project files (node_modules, .next, and log.json are ignored automatically by .gitignore)
git add .

# 4. Commit files
git commit -m "Initial commit: EcoTrace Frontend"

# 5. Link remote repository
git remote add origin https://github.com/YOUR_USERNAME/ecotrace-frontend.git

# 6. Push to remote
git push -u origin main
```

---

## Important Notes

- **Ignored Files**: `node_modules/`, `.next/`, `log.json`, `*.log`, and `.env` files are configured in `.gitignore` so they will **NOT** be uploaded to Git.
- **Installing Dependencies**: After downloading/cloning this repository on another computer, run:
  ```bash
  npm install
  ```
  to reinstall all dependencies.
