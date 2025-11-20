# WinScan - Multi-Chain Blockchain Explorer

<div align="center">
  <img src="app/icon.svg" alt="WinScan Logo" width="120" height="120" />
</div>

**WinScan** is a modern, professional multi-chain blockchain explorer built with Next.js 14 and TypeScript. Monitor multiple Cosmos SDK-based blockchains in real-time with an elegant, minimalist interface.

<div align="center">

[![Website](https://img.shields.io/badge/Website-winsnip.xyz-blue?style=for-the-badge&logo=google-chrome)](https://winsnip.xyz)
[![Twitter](https://img.shields.io/badge/Twitter-@winsnip-1DA1F2?style=for-the-badge&logo=twitter)](https://twitter.com/winsnip)
[![Telegram](https://img.shields.io/badge/Telegram-WinSnip-26A5E4?style=for-the-badge&logo=telegram)](https://t.me/winsnip)
[![GitHub](https://img.shields.io/badge/GitHub-winsnip--official-181717?style=for-the-badge&logo=github)](https://github.com/winsnip-official)

</div>

## ✨ Features

- 🌐 **Multi-Chain Support** - Monitor multiple blockchain networks from one dashboard
- 📊 **Real-Time Monitoring** - Live consensus tracking and validator status
- 🔍 **Complete Explorer** - Blocks, transactions, validators, proposals, and more
- 🌍 **Multi-Language** - Support for 7 languages (EN, ID, ZH, JA, HI, RU, VI)
- 🎨 **Modern UI** - Clean, elegant design with dark theme
- 📱 **Responsive** - Works perfectly on desktop, tablet, and mobile
- ⚡ **Fast & Optimized** - Built with performance in mind

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. **Fork this repository** (Click "Fork" button at top right)

2. **Clone your forked repository**
```bash
git clone https://github.com/winsnip-official/winscan.git
cd winscan
```

3. **Install dependencies**
```bash
npm install
```

4. **Setup environment variables**
```bash
cp .env.example .env
```

Edit `.env` if you want to use different API endpoint (optional):
```env
NEXT_PUBLIC_API_URL=https://ssl.winsnip.xyz
```

5. **Configure your chains**
- Add your chain configurations in `Chains/` directory
- See `Chains/README.md` for chain configuration format

6. **Run development server**
```bash
npm run dev
```

Visit http://localhost:3000

## 📁 Project Structure

```
winscan/
├── app/                    # Next.js app directory
│   ├── [chain]/           # Dynamic chain routes
│   ├── api/               # API routes (proxy)
│   └── page.tsx           # Home page
├── components/            # React components
├── Chains/               # Chain configurations
├── lib/                  # Utility functions
├── types/                # TypeScript types
└── public/               # Static assets
```

## 🔌 API Backend

This explorer uses **WinSnip API** as the backend service:
- **API URL**: https://ssl.winsnip.xyz
- Public and free to use
- Supports multiple Cosmos chains
- Real-time data sync

### Self-Hosted Backend (Optional)

For advanced users who want to run their own API backend:
- Backend repository: Coming soon
- Requires VPS and Node.js
- Full control over data and endpoints

Default configuration uses our public API, so you don't need to setup backend.

## 🔧 Configuration

### Adding New Chains

Create a JSON file in `Chains/` directory:

```json
{
  "chain_name": "your-chain",
  "chain_id": "your-chain-1",
  "pretty_name": "Your Chain",
  "status": "live",
  "network_type": "mainnet",
  "logo": "https://your-logo-url.png",
  "addr_prefix": "your",
  "rpc": [
    {
      "address": "https://rpc.your-chain.com",
      "provider": "Your Provider"
    }
  ],
  "api": [
    {
      "address": "https://api.your-chain.com",
      "provider": "Your Provider"
    }
  ],
  "assets": [
    {
      "name": "Your Token",
      "symbol": "YOURTOKEN",
      "denom": "uyourtoken",
      "decimals": 6
    }
  ]
}
```

### Environment Variables

**Frontend (.env)**
```env
NEXT_PUBLIC_API_URL=https://ssl.winsnip.xyz
```

By default, WinScan uses our public API. You can change this to your own API endpoint if you're running a self-hosted backend.

## 🚀 Deployment

### Deploy Frontend (Vercel)

1. **Connect to Vercel**
```bash
npm run build
vercel --prod
```

2. **Set Environment Variable**
In Vercel dashboard, add:
```
NEXT_PUBLIC_API_URL=https://ssl.winsnip.xyz
```

3. **Deploy**
Every push to main branch will auto-deploy.

### Custom Domain (Optional)

Add your domain in Vercel dashboard → Domains

## 📝 Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

## 🔐 Security & Permissions

### Repository Protection

This repository is configured with branch protection rules:

- ✅ **Public Repository** - Anyone can view and fork
- ✅ **Fork to Contribute** - Contributors must fork first
- ❌ **No Direct Commits** - Main branch is protected
- ✅ **Pull Request Required** - All changes via PR
- ✅ **Review Required** - PRs need approval before merge

### How to Contribute

1. **Fork** this repository
2. **Clone** your fork
3. Create a **new branch** (`git checkout -b feature/amazing-feature`)
4. **Commit** your changes (`git commit -m 'Add amazing feature'`)
5. **Push** to your fork (`git push origin feature/amazing-feature`)
6. Open a **Pull Request**

## 🛠️ Tech Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Charts**: Recharts
- **API**: REST API (WinSnip public endpoint)

## 📊 Features Breakdown

### 🏠 Dashboard
- Overview statistics
- Network status
- Chain selector

### 🔍 Explorer
- **Blocks** - Real-time block explorer
- **Transactions** - Transaction search and details
- **Accounts** - Account balances and history
- **Validators** - Validator list and details
- **Proposals** - Governance proposals
- **Assets** - Token information

### ⚙️ Advanced Features
- **Consensus** - Real-time consensus monitoring
- **State Sync** - State sync configuration generator
- **Network** - Network information and endpoints
- **Uptime** - Validator uptime tracking

## 🌍 Multi-Language Support

Supported languages:
- 🇬🇧 English
- 🇮🇩 Indonesian
- 🇨🇳 Chinese
- 🇯🇵 Japanese
- 🇮🇳 Hindi
- 🇷🇺 Russian
- 🇻🇳 Vietnamese

## 📜 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

### What this means:
- ✅ Free to use, modify, and distribute
- ✅ Can use commercially
- ✅ Can fork and create your own version
- ⚠️ Must include original license
- ⚠️ No warranty provided

## 🤝 Contributing

We welcome contributions from the community! Here's how to get started:

### For Contributors

#### 🔧 Setup Development Environment

1. **Fork this repository**
   - Click the "Fork" button at the top right
   - This creates your own copy of the repository

2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR-USERNAME/winscan.git
   cd winscan
   ```

3. **Add upstream remote**
   ```bash
   git remote add upstream https://github.com/winsnip-official/winscan.git
   ```

4. **Install dependencies**
   ```bash
   npm install
   ```

#### 📝 Development Workflow

1. **Switch to dev branch** (IMPORTANT!)
   ```bash
   git checkout dev
   ```

2. **ALWAYS pull latest changes before starting work**
   ```bash
   git pull origin dev
   ```

3. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/bug-description
   ```

4. **Make your changes**
   - Write clean, readable code
   - Follow existing code style
   - Add comments where necessary

5. **Test your changes**
   ```bash
   npm run dev    # Test in development
   npm run build  # Ensure it builds successfully
   ```

6. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add amazing feature"
   # or
   git commit -m "fix: resolve issue with..."
   ```

7. **Pull again before pushing** (avoid conflicts)
   ```bash
   git pull origin dev
   ```

8. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

9. **Create Pull Request**
   - Go to your fork on GitHub
   - Click "Pull Request" button
   - Target: `winsnip-official/winscan` branch `dev`
   - Describe your changes clearly

### 🌿 Branch Strategy

- **`main`** - Production branch (stable releases only)
- **`dev`** - Development branch (active development)
- **`feature/*`** - New features
- **`fix/*`** - Bug fixes

**⚠️ IMPORTANT:** Always work on `dev` branch, never push directly to `main`!

### ✅ Contribution Guidelines

**Code Quality:**
- Follow TypeScript best practices
- Use meaningful variable/function names
- Keep functions small and focused
- Add proper type definitions

**Commit Messages:**
- Use conventional commits format:
  - `feat:` - New feature
  - `fix:` - Bug fix
  - `docs:` - Documentation changes
  - `style:` - Code style changes (formatting)
  - `refactor:` - Code refactoring
  - `test:` - Adding tests
  - `chore:` - Maintenance tasks

**Examples:**
```bash
git commit -m "feat: add wallet integration with Keplr"
git commit -m "fix: resolve balance display issue"
git commit -m "docs: update contributing guidelines"
```

**Testing:**
- Test your changes thoroughly
- Check responsive design (mobile, tablet, desktop)
- Test on different browsers if possible
- Ensure no console errors

**Pull Request:**
- Clear title and description
- Link related issues
- Add screenshots/videos if UI changes
- Wait for review before merging

### 🚫 What NOT to Do

- ❌ Don't push directly to `main` branch
- ❌ Don't commit `node_modules/` or `.env` files
- ❌ Don't make too many unrelated changes in one PR
- ❌ Don't ignore ESLint warnings
- ❌ Don't forget to pull before pushing

### 🎯 Good First Issues

Looking for where to start? Check out issues labeled:
- `good first issue` - Easy tasks for beginners
- `help wanted` - Community help needed
- `bug` - Bug fixes needed
- `enhancement` - Feature requests

### 💡 Need Help?

- 💬 Ask in [Telegram Group](https://t.me/winsnip)
- 📧 Email: admin@winsnip.xyz
- 🐛 Create an issue on GitHub

### 🏆 Contributors

Thank you to all our amazing contributors! 🎉

<a href="https://github.com/winsnip-official/winscan/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=winsnip-official/winscan" />
</a>

**Want to see your name here?** Start contributing today!

## 📞 Support & Community

Need help or want to connect? Join our community:

- 🌐 **Website**: [winsnip.xyz](https://winsnip.xyz)
- 🐦 **Twitter**: [@winsnip](https://twitter.com/winsnip)
- 💬 **Telegram**: [t.me/winsnip](https://t.me/winsnip)
- 💻 **GitHub**: [github.com/winsnip-official](https://github.com/winsnip-official)
- 🐛 **Issues**: [GitHub Issues](https://github.com/winsnip-official/winscan/issues)

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Powered by [Cosmos SDK](https://cosmos.network/)
- Inspired by [Ping.pub](https://ping.pub/) and [Mintscan](https://www.mintscan.io/)

## 💎 Supported Chains

WinScan currently supports the following blockchain networks:

### Mainnets
<div align="center">

| Chain | Network | Status |
|-------|---------|--------|
| <img src="https://file.winsnip.xyz/file/uploads/paxi.jpg" width="20"/> **Paxi Network** | Mainnet | 🟢 Live |
| <img src="https://pbs.twimg.com/profile_images/1841523650043772928/EeZIYE7B_400x400.jpg" width="20"/> **Axone** | Mainnet | 🟢 Live |
| <img src="https://pbs.twimg.com/profile_images/1948901739765084160/RdCGkJt4_400x400.jpg" width="20"/> **BitBadges** | Mainnet | 🟢 Live |
| <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/gitopia/images/gitopia.png" width="20"/> **Gitopia** | Mainnet | 🟢 Live |
| <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/humans/images/heart-dark-mode.svg" width="20"/> **Humans.ai** | Mainnet | 🟢 Live |
| <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/shido/images/shido.png" width="20"/> **Shido** | Mainnet | 🟢 Live |

</div>

### Testnets
<div align="center">

| Chain | Network | Status |
|-------|---------|--------|
| <img src="https://pbs.twimg.com/profile_images/1802555804798857216/ZTqy2yxX_400x400.jpg" width="20"/> **CNHO-Stables** | Testnet | 🟡 Testing |
| <img src="https://pbs.twimg.com/profile_images/1938593981517955072/vTcJ4t5i_400x400.jpg" width="20"/> **Safrochain** | Testnet | 🟡 Testing |
| <img src="https://pbs.twimg.com/profile_images/1914464060265127936/z2ONvvpp_400x400.png" width="20"/> **Lumera** | Testnet | 🟡 Testing |

</div>

**Want to add your chain?** Create a JSON config in `Chains/` directory and submit a PR!

## 🤝 Partners

We are proud to partner with these amazing projects:

<div align="center">

### Blockchain Networks

<table>
  <tr>
    <td align="center" width="200">
      <a href="https://paxi.network" target="_blank">
        <img src="https://file.winsnip.xyz/file/uploads/paxi.jpg" width="80" height="80" alt="Paxi Network" style="border-radius: 50%;"/>
        <br />
        <b>Paxi Network</b>
      </a>
      <br />
      <sub>The Future of DeFi</sub>
    </td>
    <td align="center" width="200">
      <a href="https://axone.xyz" target="_blank">
        <img src="https://pbs.twimg.com/profile_images/1841523650043772928/EeZIYE7B_400x400.jpg" width="80" height="80" alt="Axone" style="border-radius: 50%;"/>
        <br />
        <b>Axone</b>
      </a>
      <br />
      <sub>Decentralized Knowledge</sub>
    </td>
    <td align="center" width="200">
      <a href="https://bitbadges.io" target="_blank">
        <img src="https://pbs.twimg.com/profile_images/1948901739765084160/RdCGkJt4_400x400.jpg" width="80" height="80" alt="BitBadges" style="border-radius: 50%;"/>
        <br />
        <b>BitBadges</b>
      </a>
      <br />
      <sub>Digital Badges Protocol</sub>
    </td>
  </tr>
</table>

### Become a Partner

Interested in partnering with WinScan? Contact us:
- 📧 Email: [admin@winsnip.xyz](mailto:admin@winsnip.xyz)
- 💬 Telegram: [@winsnip](https://t.me/winsnip)

</div>

## 📈 Roadmap

- [ ] WebSocket support for real-time updates
- [ ] Advanced analytics and charts
- [ ] IBC tracking
- [ ] NFT explorer
- [ ] Token swap integration
- [ ] Wallet integration

---

<div align="center">

**Made with ❤️ by [WinSnip](https://winsnip.xyz) for the Cosmos ecosystem**

[![Website](https://img.shields.io/badge/🌐-winsnip.xyz-blue)](https://winsnip.xyz)
[![Twitter](https://img.shields.io/badge/🐦-@winsnip-1DA1F2)](https://twitter.com/winsnip)
[![Telegram](https://img.shields.io/badge/💬-WinSnip-26A5E4)](https://t.me/winsnip)

⭐ **Star this repo if you find it useful!**

</div>
