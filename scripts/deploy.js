const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const CounterFactory = await hre.ethers.getContractFactory("Counter");

  console.log("Deploying Counter...");
  const counterContract = await CounterFactory.deploy();

  await counterContract.waitForDeployment();

  const deployedAddress = await counterContract.getAddress();

  console.log("Counter contract deployed to:", deployedAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });