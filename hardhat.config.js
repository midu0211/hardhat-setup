// Dòng này BẮT BUỘC phải có và không bị lỗi cú pháp
require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.26", // Đảm bảo khớp version trong contract
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545"
    }
    // Bạn có thể thêm các mạng khác ở đây (sepolia, mainnet, ...)
  },
  // Bạn có thể có thêm các cấu hình khác (etherscan, gasReporter, ...)
};