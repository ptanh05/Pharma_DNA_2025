# 🚀 Hướng dẫn Migrate sang Neo Blockchain

## ⚠️ QUAN TRỌNG: Neo không hỗ trợ EVM/Solidity!

Neo blockchain **KHÔNG tương thích** với Ethereum Virtual Machine (EVM) và **KHÔNG hỗ trợ Solidity**. Để migrate sang Neo, bạn cần:

1. **Viết lại Smart Contract** bằng một trong các ngôn ngữ Neo hỗ trợ:
   - **C#** (khuyến nghị) - Neo DevPack Dotnet
   - **Python** - Boa
   - **Go** - NeoGo
   - **Java** - neow3j
   - **TypeScript** - NEO•ONE

2. **Sử dụng Neo Blockchain Toolkit** thay vì Hardhat
3. **Deploy bằng Neo CLI** hoặc Neo-GUI

---

## 📋 Bước 1: Tìm hiểu về Neo

### Neo N3 Features
- **NeoVM**: Máy ảo cho smart contracts
- **NEP Standards**: 
  - NEP-17: Token standard (tương đương ERC-20)
  - NEP-11: NFT standard (tương đương ERC-721)
- **Multi-language support**: C#, Python, Go, Java, TypeScript
- **dBFT Consensus**: Delegated Byzantine Fault Tolerance
- **High TPS**: Lên đến 10,000 transactions/second

### Tài liệu
- [Neo Documentation](https://docs.neo.org/)
- [Neo Developer Portal](https://developers.neo.org/)
- [Neo GitHub](https://github.com/neo-project)

---

## 🔧 Bước 2: Cài đặt môi trường phát triển

### Option 1: C# (Khuyến nghị)

```bash
# Cài đặt .NET SDK
# https://dotnet.microsoft.com/download

# Cài đặt Neo DevPack
dotnet add package Neo.SmartContract.Framework
dotnet add package Neo.SmartContract.Framework.Services

# Cài đặt Neo Blockchain Toolkit cho VS Code
# Extension: Neo Blockchain Toolkit
```

### Option 2: Python

```bash
# Cài đặt Python 3.8+
pip install boa-neo
```

### Option 3: TypeScript

```bash
# Cài đặt NEO•ONE
npm install -g @neo-one/cli
```

---

## 📝 Bước 3: Viết lại Smart Contract

### Ví dụ: PharmaNFT Contract bằng C#

```csharp
using Neo;
using Neo.SmartContract;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;
using System;
using System.Numerics;

[ContractPermission("*", "transfer")]
public class PharmaNFT : Nep11Token<TokenState>
{
    // Role enum
    public enum Role : byte
    {
        None = 0,
        Manufacturer = 1,
        Distributor = 2,
        Pharmacy = 3,
        Admin = 4
    }

    // Storage keys
    private static readonly byte[] RolesMapKey = "roles".ToByteArray();
    private static readonly byte[] NextTokenIdKey = "nextTokenId".ToByteArray();

    // Events
    [DisplayName("RoleAssigned")]
    public static event Action<UInt160, Role> OnRoleAssigned;

    [DisplayName("ProductMinted")]
    public static event Action<BigInteger, UInt160, string> OnProductMinted;

    // Owner only modifier
    private static void OnlyOwner()
    {
        ExecutionEngine.Assert(Runtime.CheckWitness(Owner), "Only owner");
    }

    // Role management
    public static void AssignRole(UInt160 user, Role role)
    {
        OnlyOwner();
        StorageMap roles = new StorageMap(Storage.CurrentContext, RolesMapKey);
        roles.Put(user, (byte)role);
        OnRoleAssigned(user, role);
    }

    public static Role GetRole(UInt160 user)
    {
        StorageMap roles = new StorageMap(Storage.CurrentContext, RolesMapKey);
        return (Role)(byte)roles.Get(user);
    }

    // Mint NFT (Manufacturer only)
    public static BigInteger MintProductNFT(string uri)
    {
        UInt160 caller = Runtime.CallingScriptHash;
        Role role = GetRole(caller);
        ExecutionEngine.Assert(role == Role.Manufacturer, "Only manufacturer");

        BigInteger tokenId = GetNextTokenId();
        TokenState token = new TokenState
        {
            Owner = caller,
            Name = "PharmaNFT",
            TokenURI = uri
        };

        Mint(tokenId, token);
        OnProductMinted(tokenId, caller, uri);
        return tokenId;
    }

    private static BigInteger GetNextTokenId()
    {
        BigInteger nextId = (BigInteger)Storage.Get(Storage.CurrentContext, NextTokenIdKey);
        Storage.Put(Storage.CurrentContext, NextTokenIdKey, nextId + 1);
        return nextId;
    }
}
```

### Ví dụ: PharmaNFT Contract bằng Python (Boa)

```python
from boa3.builtin import CreateNewEvent, storage
from boa3.builtin.interop import runtime
from boa3.builtin.type import UInt160
from typing import Dict

# Events
RoleAssigned = CreateNewEvent(
    [
        ('user', UInt160),
        ('role', int)
    ]
)

ProductMinted = CreateNewEvent(
    [
        ('tokenId', int),
        ('manufacturer', UInt160),
        ('uri', str)
    ]
)

# Role enum
NONE = 0
MANUFACTURER = 1
DISTRIBUTOR = 2
PHARMACY = 3
ADMIN = 4

def assign_role(user: UInt160, role: int) -> bool:
    """
    Assign role to user (owner only)
    """
    caller = runtime.calling_script_hash
    owner = get_owner()
    assert caller == owner, "Only owner"
    
    storage.put(user, role)
    RoleAssigned(user, role)
    return True

def get_role(user: UInt160) -> int:
    """
    Get user role
    """
    return storage.get(user, NONE)

def mint_product_nft(uri: str) -> int:
    """
    Mint new product NFT (manufacturer only)
    """
    caller = runtime.calling_script_hash
    role = get_role(caller)
    assert role == MANUFACTURER, "Only manufacturer"
    
    token_id = get_next_token_id()
    # Mint logic here...
    
    ProductMinted(token_id, caller, uri)
    return token_id
```

---

## 🚀 Bước 4: Deploy Contract lên Neo

### Sử dụng Neo CLI

```bash
# Cài đặt Neo CLI
# https://github.com/neo-project/neo-node

# Deploy contract
neo> deploy PharmaNFT.nef

# Invoke contract
neo> invoke PharmaNFT assignRole [address] [role]
```

### Sử dụng Neo-GUI

1. Mở Neo-GUI
2. Chọn "Advanced" > "Deploy Contract"
3. Chọn file `.nef` (Neo Execution Format)
4. Điền thông tin contract
5. Deploy

### Sử dụng Neo Blockchain Toolkit (VS Code)

1. Cài đặt extension "Neo Blockchain Toolkit"
2. Tạo Neo Express network
3. Deploy contract từ VS Code
4. Test contract

---

## 🔄 Bước 5: Cập nhật Frontend/Backend

### Cập nhật Blockchain Config

File `.env`:
```env
# Neo N3 Testnet
BLOCKCHAIN_NETWORK=neo-testnet
NEO_TESTNET_RPC=https://seed1t5.neo.org:20331
NEO_TESTNET_CHAIN_ID=844378958
NEO_TESTNET_EXPLORER=https://testnet.neoscan.io

# Neo N3 Mainnet
# BLOCKCHAIN_NETWORK=neo
# NEO_RPC=https://seed1.neo.org:10331
# NEO_CHAIN_ID=860833102
# NEO_EXPLORER=https://neoscan.io
```

### Sử dụng Neo SDK

#### JavaScript/TypeScript

```bash
npm install @cityofzion/neon-js
```

```typescript
import { Neon, wallet, rpc } from '@cityofzion/neon-js';

// Connect to Neo network
const network = {
  name: 'TestNet',
  extra: {
    neoscan: 'https://testnet.neoscan.io',
    rpcServer: 'https://seed1t5.neo.org:20331'
  }
};

// Invoke contract
const script = Neon.create.script({
  scriptHash: 'YOUR_CONTRACT_HASH',
  operation: 'mintProductNFT',
  args: [Neon.u.str2hexstring('ipfs://...')]
});

const result = await Neon.doInvoke({
  api: network,
  account: account,
  script: script
});
```

#### Python

```bash
pip install neo-python
```

```python
from neo import SmartContract
from neo.Network.RPC import RPCClient

# Connect to Neo
rpc = RPCClient('https://seed1t5.neo.org:20331')

# Invoke contract
result = rpc.invoke_function(
    contract_hash='YOUR_CONTRACT_HASH',
    operation='mintProductNFT',
    params=['ipfs://...']
)
```

---

## 📊 Bước 6: So sánh Solidity vs Neo

| Feature | Solidity (Ethereum) | Neo (C#/Python) |
|---------|---------------------|------------------|
| Language | Solidity | C#, Python, Go, Java, TypeScript |
| Standard | ERC-721 | NEP-11 |
| Deployment | Hardhat, Truffle | Neo CLI, Neo-GUI |
| Gas | ETH/Gwei | GAS |
| Decimals | 18 | 8 |
| RPC | JSON-RPC | JSON-RPC (khác format) |
| Wallet | MetaMask | NeoLine, O3 Wallet |

---

## ⚠️ Lưu ý quan trọng

1. **Không thể dùng Hardhat với Neo**: Neo không hỗ trợ EVM, nên Hardhat không hoạt động.

2. **Cần viết lại toàn bộ contract**: Không có tool tự động convert Solidity sang Neo.

3. **Wallet khác**: MetaMask không hỗ trợ Neo. Cần dùng:
   - **NeoLine** (browser extension)
   - **O3 Wallet** (desktop/mobile)
   - **Neon Wallet** (desktop)

4. **RPC format khác**: Neo RPC API khác với Ethereum RPC.

5. **Gas model khác**: Neo sử dụng GAS với 8 decimals, không phải 18.

---

## 🔗 Tài nguyên hữu ích

- [Neo Documentation](https://docs.neo.org/)
- [Neo Developer Portal](https://developers.neo.org/)
- [Neo Smart Contract Examples](https://github.com/neo-project/examples)
- [Neo Blockchain Toolkit](https://github.com/neo-project/neo-blockchain-toolkit)
- [NEO•ONE Documentation](https://neo-one.io/docs)
- [Neo Python Documentation](https://neo-python.readthedocs.io/)

---

## 📝 Checklist Migration

- [ ] Nghiên cứu Neo N3 architecture
- [ ] Chọn ngôn ngữ (C#/Python/Go/Java/TypeScript)
- [ ] Cài đặt development tools
- [ ] Viết lại smart contract
- [ ] Test contract trên Neo Testnet
- [ ] Cập nhật frontend/backend để tương tác với Neo
- [ ] Cập nhật wallet integration (NeoLine/O3)
- [ ] Deploy lên Neo Mainnet
- [ ] Update documentation

---

## 💡 Kết luận

Migrate sang Neo là một quá trình lớn vì cần viết lại toàn bộ smart contract. Tuy nhiên, Neo cung cấp nhiều tính năng mạnh mẽ và hỗ trợ nhiều ngôn ngữ lập trình phổ biến, giúp việc phát triển dễ dàng hơn.

Nếu bạn cần hỗ trợ, hãy tham khảo:
- [Neo Discord](https://discord.gg/neo)
- [Neo Reddit](https://www.reddit.com/r/NEO/)
- [Neo Stack Overflow](https://stackoverflow.com/questions/tagged/neo-blockchain)

