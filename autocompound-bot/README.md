# WinScan Auto-Compound Bot

Automated staking rewards compounding bot for Cosmos chains using Authz grants.

## 🏗️ Architecture

```
┌─────────────────┐
│   Delegator     │
│   (User)        │
└────────┬────────┘
         │ 1. Grant authorization
         │    (MsgGrant via WinScan UI)
         ▼
┌─────────────────┐
│   Blockchain    │◄──────┐
│   (Cosmos SDK)  │       │
└────────┬────────┘       │
         │                │
         │ 2. Query       │ 4. Execute
         │    Grants      │    MsgExec
         │                │
         ▼                │
┌─────────────────────────┴──┐
│   Validator's Bot          │
│   (AutoCompoundBot)        │
│                            │
│   - Monitor grants         │
│   - Check rewards          │
│   - Compound automatically │
└────────────────────────────┘
```

**Key Features:**
- ✅ **Decentralized** - Connects directly to blockchain RPC
- ✅ **Non-custodial** - Uses Authz grants, never controls user funds
- ✅ **Multi-chain** - Supports standard Cosmos chains and EVM-compatible chains (coin_type 60)
- ✅ **Configurable** - Frequency settings per chain (hourly/daily/weekly/monthly)

## 🚀 Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/winsnip-official/winscan.git
cd winscan/autocompound-bot
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configuration

Copy environment template:

```bash
cp .env.example .env
```

Edit `.env`:

```env
DEFAULT_MNEMONIC=your twelve word mnemonic phrase here
```

**Generate a new mnemonic (recommended):**

```bash
npx @cosmjs/cli@latest
> const wallet = await DirectSecp256k1HdWallet.generate(12)
> console.log(wallet.mnemonic)
```

⚠️ **Security:** Keep this mnemonic secure! It controls the operator wallet that executes transactions.

### 4. Chain Configuration

Add your chain configuration in `Chains/` directory. Example:

**File: `Chains/mychain-mainnet.json`**

```json
{
  "chain_name": "mychain-mainnet",
  "chain_id": "mychain-1",
  "bech32_prefix": "mychain",
  "coin_type": "118",
  "apis": {
    "rpc": [
      {
        "address": "https://rpc.mychain.network",
        "provider": "MyProvider"
      }
    ],
    "rest": [
      {
        "address": "https://api.mychain.network",
        "provider": "MyProvider"
      }
    ]
  },
  "staking": {
    "staking_tokens": [
      {
        "denom": "utoken"
      }
    ]
  },
  "fees": {
    "fee_tokens": [
      {
        "denom": "utoken",
        "fixed_min_gas_price": 0.025,
        "low_gas_price": 0.025,
        "average_gas_price": 0.05,
        "high_gas_price": 0.1
      }
    ]
  },
  "autocompound_operators": [
    {
      "moniker": "YourValidator",
      "validator_address": "mychainvaloper1...",
      "grantee_address": "mychain1...",
      "supported": true,
      "default_frequency": "daily",
      "vote_option": "YES"
    }
  ]
}
```

**Configuration Fields:**

| Field | Description | Example |
|-------|-------------|---------|
| `chain_name` | Unique identifier | `"osmosis-mainnet"` |
| `chain_id` | Blockchain chain ID | `"osmosis-1"` |
| `bech32_prefix` | Address prefix | `"osmo"` |
| `coin_type` | BIP44 coin type | `"118"` (Cosmos), `"60"` (ETH) |
| `grantee_address` | Bot operator address | Generated from mnemonic |
| `default_frequency` | Compound frequency | `"hourly"`, `"daily"`, `"weekly"`, `"monthly"` |

**Coin Type Support:**
- `"118"` - Standard Cosmos chains (SHA256 signing)
- `"60"` - EVM-compatible chains (Keccak256 signing, ETH addresses)

### 5. Fund Operator Wallet

The bot needs gas fees to execute transactions. Fund the operator address with native tokens.

**Get operator address:**

```bash
npm run build
npm start
# Check logs for operator address
```

Example operator addresses (from same mnemonic):
- Cosmos Hub: `cosmos1h8a79xln9gam52c6wzkulz2txyr0rkcrsdkzam`
- Osmosis: `osmo1h8a79xln9gam52c6wzkulz2txyr0rkcrtp3ck8`
- Shido (EVM): `shido1h8a79xln9gam52c6wzkulz2txyr0rkcrwcuh60`

### 6. Run Bot

**Development:**

```bash
npm run dev
```

**Production:**

```bash
npm run build
npm start
```

**With PM2:**

```bash
pm2 start ecosystem.config.js
pm2 logs autocompound-bot
pm2 monit
```

## 📡 API Endpoints

Bot exposes a REST API for monitoring and manual control:

### Get Status

```bash
GET http://localhost:4000/api/autocompound/status
```

Response:
```json
{
  "isRunning": true,
  "operatorAddress": "cosmos1h8a79xln9gam52c6wzkulz2txyr0rkcrsdkzam",
  "tasksCount": 3,
  "tasks": [
    {
      "chainId": "cosmoshub-4",
      "granter": "cosmos1abc...",
      "validator": "cosmosvaloper1def...",
      "frequency": "daily",
      "lastRun": "2025-11-29T10:30:00Z",
      "hasCommissionGrant": true,
      "hasVoteGrant": true
    }
  ]
}
```

### Load Tasks from Chain

```bash
POST http://localhost:4000/api/autocompound/load-tasks/cosmoshub-4
```

### Manual Execute

```bash
POST http://localhost:4000/api/autocompound/execute
Content-Type: application/json

{
  "chainId": "cosmoshub-4",
  "granter": "cosmos1abc...",
  "validator": "cosmosvaloper1def..."
}
```

### Start/Stop Bot

```bash
POST http://localhost:4000/api/autocompound/start
POST http://localhost:4000/api/autocompound/stop
```

## 🔄 How It Works

1. **Grant Detection**: Bot queries blockchain for Authz grants where it's the grantee
2. **Task Scheduling**: Checks every 10 minutes, executes based on frequency settings
3. **Reward Claiming**: When time is due:
   - Queries available rewards
   - Skips if rewards < 0.01 token (gas optimization)
   - Executes `MsgExec` with nested messages:
     - `MsgWithdrawDelegatorReward` - Claim rewards
     - `MsgWithdrawValidatorCommission` (if validator)
     - `MsgDelegate` - Restake claimed rewards
4. **Transaction Signing**: Uses appropriate signing method:
   - SHA256 for standard Cosmos chains
   - Keccak256 for EVM-compatible chains

## 🔐 Security Best Practices

1. **Mnemonic Management**:
   - Never commit `.env` to version control
   - Use environment variables in production
   - Consider hardware wallet or KMS for high-value operations

2. **Gas Fee Monitoring**:
   - Set up balance alerts for operator wallet
   - Calculate required balance: `tasks × frequency × gas_fee`
   - Refill before balance runs low

3. **Grant Permissions**:
   - Bot can only execute authorized operations
   - Users retain full control (can revoke anytime)
   - Grants have expiration dates (default 1 year)

## 📊 Monitoring

### Logs

```bash
# PM2
pm2 logs autocompound-bot --lines 100

# Direct
tail -f logs/out.log
```

### Metrics

Check `/api/autocompound/status` for:
- Active tasks count
- Last execution time per task
- Operator address and balance
- Running status

## 🛠️ Troubleshooting

### No tasks loaded

**Possible causes:**
- RPC/REST endpoints not accessible
- No grants exist where bot is grantee
- Operator address mismatch in chain config

**Solution:**
1. Test RPC: `curl https://rpc.chain.network/status`
2. Verify grants on-chain explorer
3. Check `grantee_address` matches operator address

### Transaction fails

**Common errors:**

| Error | Cause | Solution |
|-------|-------|----------|
| `out of gas` | Gas limit too low | Increase gas in `AutoCompoundBot.ts` |
| `insufficient funds` | Not enough gas fees | Fund operator wallet |
| `authorization not found` | Grant expired/revoked | User needs to re-grant |
| `account sequence mismatch` | Parallel execution | Normal - will retry next cycle |

### Rewards not compounding

**Checklist:**
- [ ] Rewards balance > 0.01 token?
- [ ] Frequency time elapsed?
- [ ] Gas fees available?
- [ ] Grant still valid?

Check task status via API:
```bash
curl http://localhost:4000/api/autocompound/status | jq '.tasks[] | select(.chainId=="your-chain")'
```

## 📁 Project Structure

```
autocompound-bot/
├── src/
│   ├── index.ts              # Express server & initialization
│   └── AutoCompoundBot.ts    # Core bot logic
├── Chains/                   # Chain configurations
│   ├── cosmoshub-mainnet.json
│   ├── osmosis-mainnet.json
│   └── shido-mainnet.json
├── dist/                     # Compiled JavaScript
├── logs/                     # Application logs
├── .env                      # Environment variables (gitignored)
├── .env.example              # Environment template
├── ecosystem.config.js       # PM2 configuration
├── package.json
└── tsconfig.json
```

## 🔗 Related Projects

- **WinScan Explorer**: https://winscan.io
- **Cosmos SDK**: https://github.com/cosmos/cosmos-sdk
- **CosmJS**: https://github.com/cosmos/cosmjs

## 📄 License

MIT License - See LICENSE file for details

## 🤝 Support

- **Discord**: https://discord.gg/winscan
- **Telegram**: https://t.me/winscan
- **GitHub Issues**: https://github.com/winsnip-official/winscan/issues
