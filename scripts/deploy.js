// scripts/deploy.js
const hre = require("hardhat");

async function main() {
  const initialSupply = 1000000; 
  
  const Group11Token = await hre.ethers.getContractFactory("Group11Token");
  console.log("Deploying Group11Token...");

  const group11Token = await Group11Token.deploy(initialSupply);


  await group11Token.waitForDeployment();


  console.log(`Group11Token deployed to: ${group11Token.target}`);
  console.log(`Initial supply (scaled): ${(await group11Token.totalSupply()).toString()}`);
  console.log(`Owner: ${await group11Token.owner()}`);
  console.log(`Sale start time (timestamp): ${(await group11Token.saleStartTime()).toString()}`);
  console.log(`Tokens available for sale (actual count): ${(await group11Token.getTokensAvailableForSale()).toString()}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });