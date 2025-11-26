# WinScan - Multi-Chain Blockchain Explorer

<div align="center">
  <img src="app/icon.svg" alt="WinScan Logo" width="120" height="120" />
  
  **Modern blockchain explorer for Cosmos ecosystem**
  
  [![Website](https://img.shields.io/badge/Website-winsnip.xyz-blue?style=for-the-badge)](https://winsnip.xyz)
  [![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)
  [![Twitter](https://img.shields.io/badge/Twitter-@winsnip-1DA1F2?style=for-the-badge)](https://twitter.com/winsnip)
</div>

## ✨ Features

- 🌐 Multi-chain support for Cosmos networks
- 📊 Real-time blocks, transactions, validators tracking
- 💼 Keplr wallet integration (stake, vote, transfer)
- 🗳️ Governance proposals with voting
- 📈 Validator uptime monitoring
- 🌍 7 languages support
- 🎨 Modern dark theme UI
- 📱 Fully responsive

## 🚀 Quick Start

```bash
# Clone repository
git clone https://github.com/winsnip-official/winscan.git
cd winscan

# Install dependencies
npm install

# Run development server
npm run dev
```

Visit http://localhost:3000

## 📖 Documentation

- **[Chain Configuration Guide](CHAIN-GUIDELINES.md)** - Add your blockchain
- **[Contributing Guide](CONTRIBUTING.md)** - Contribution guidelines
- **[Security Policy](SECURITY.md)** - Report vulnerabilities
- **[License](LICENSE)** - Usage terms and restrictions

## 🔧 Configuration

### Adding New Chains

1. Create `yourchain-mainnet.json` in `Chains/` directory
2. Configure RPC, API endpoints, and token details
3. See [CHAIN-GUIDELINES.md](CHAIN-GUIDELINES.md) for complete format

### Environment Variables

```env
NEXT_PUBLIC_API_URL=https://ssl.winsnip.xyz
```

## 🚀 Deployment

### Vercel (Recommended)

```bash
npm run build
vercel --prod
```

Add environment variable in Vercel dashboard:
```
NEXT_PUBLIC_API_URL=https://ssl.winsnip.xyz
```

## 🛠️ Tech Stack

<div align="center">

| Category | Technology |
|----------|-----------|
| **Framework** | Next.js 14 (App Router) |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS |
| **Icons** | Lucide React |
| **Charts** | Recharts |
| **API** | REST (WinSnip Public) |
| **Wallet** | Keplr / Leap / Cosmostation |

</div>

## 📜 License & Copyright

**© 2025 WinSnip Official. All Rights Reserved.**

This project is licensed under **MIT License with Additional Restrictions**:

✅ **ALLOWED:**
- Use for personal, educational, or commercial purposes
- Fork and modify the code
- Distribute and sublicense

❌ **PROHIBITED:**
- Remove or alter WinSnip branding, logos, or attribution
- Claim this work as your own
- Misrepresent the origin of this software

⚠️ **REQUIRED:**
- Maintain copyright notice and license in all copies
- Keep visible attribution to WinSnip in public deployments
- Include "Built on Trusted Infrastructure" or similar attribution

**For full license terms, see [LICENSE](LICENSE) file.**

Violation of these terms may result in legal action and license revocation.

## 🤝 Contributing

We welcome contributions! Please read [CONTRIBUTING.md](CONTRIBUTING.md) first.

**Quick steps:**
1. Fork this repository
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open Pull Request to `dev` branch

## 📞 Support

- 🌐 Website: [winsnip.xyz](https://winsnip.xyz)
- 🐦 Twitter: [@winsnip](https://twitter.com/winsnip)
- 💬 Telegram: [t.me/winsnip](https://t.me/winsnip)
- 💻 GitHub: [github.com/winsnip-official](https://github.com/winsnip-official)

## 💎 Supported Chains

### Mainnets
- Paxi Network, Axone, BitBadges, Gitopia, Humans.ai, Shido

### Testnets
- CNHO-Stables, Safrochain, Lumera

**Want to add your chain?** See [CHAIN-GUIDELINES.md](CHAIN-GUIDELINES.md)

---

<div align="center">

**Made with ❤️ by [WinSnip](https://winsnip.xyz)**

⭐ Star this repo if you find it useful!

[![Website](https://img.shields.io/badge/🌐-winsnip.xyz-blue)](https://winsnip.xyz)
[![Twitter](https://img.shields.io/badge/🐦-@winsnip-1DA1F2)](https://twitter.com/winsnip)
[![Telegram](https://img.shields.io/badge/💬-WinSnip-26A5E4)](https://t.me/winsnip)

</div>
