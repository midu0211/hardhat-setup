// Dòng này BẮT BUỘC phải có và không bị lỗi cú pháp
require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.26", // Đảm bảo khớp version trong contract
  networks: {
    hardhat: { // Configuration for the default Hardhat Network (when you run `npx hardhat node` or tests without --network)
      accounts: {
        accountsBalance: "5000000000000000000000000", // 5 Million ETH in wei, for example
      },
    },
    localhost: { // Configuration for when you explicitly use --network localhost
      url: "http://127.0.0.1:8545",
      // For localhost, if it's a separate node (like `npx hardhat node` and then `npx hardhat run --network localhost`),
      // the accounts are determined by that node.
      // However, if `localhost` is just an alias for the in-process hardhat network, this balance might apply.
      // To be safe, also consider adding accountsBalance here if you specifically target localhost often.
      // accounts: {
      //   accountsBalance: "5000000000000000000000000",
      // },
    }
    // Bạn có thể thêm các mạng khác ở đây (sepolia, mainnet, ...)
    // Ví dụ cho Sepolia:
    // sepolia: {
    //   url: "YOUR_SEPOLIA_RPC_URL", // Thay bằng RPC URL của bạn từ Infura/Alchemy
    //   accounts: ["YOUR_PRIVATE_KEY_FOR_DEPLOYMENT"] // Thay bằng private key của tài khoản deploy
    // }
  },
  // Bạn có thể có thêm các cấu hình khác (etherscan, gasReporter, ...)
  // Ví dụ Etherscan API key (nếu bạn muốn verify contract)
  // etherscan: {
  //   apiKey: "YOUR_ETHERSCAN_API_KEY"
  // },
  // gasReporter: {
  //  enabled: (process.env.REPORT_GAS) ? true : false,
  //  currency: "USD",
  // }
};