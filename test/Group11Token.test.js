// test/Group11Token.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Group11Token - Lab 2 Sale Campaign", function () {
  let Group11TokenFactory;
  let group11Token;
  let owner;
  let buyer1;
  let buyer2;
  let otherAccounts;

  const INITIAL_SUPPLY_WHOLE_TOKENS = 1000000; 
  const SALE_DURATION_SECONDS = 30 * 24 * 60 * 60; 

  const PRICE_TIER_1 = ethers.parseEther("5");
  const PRICE_TIER_2 = ethers.parseEther("10");

  const scaleTokens = (amount) => ethers.parseUnits(amount.toString(), 18);

  beforeEach(async function () {
    Group11TokenFactory = await ethers.getContractFactory("Group11Token");
    [owner, buyer1, buyer2, ...otherAccounts] = await ethers.getSigners();
    group11Token = await Group11TokenFactory.deploy(INITIAL_SUPPLY_WHOLE_TOKENS);
    await group11Token.waitForDeployment();
  });

  describe("Initial State & ERC20 Core", function () {
    it("Should mint the total supply to the contract owner", async function () {
      const ownerBalance = await group11Token.balanceOf(owner.address);
      const totalSupply = await group11Token.totalSupply();
      expect(ownerBalance).to.equal(totalSupply);
      expect(totalSupply).to.equal(scaleTokens(INITIAL_SUPPLY_WHOLE_TOKENS));
    });

    it("Should support standard ERC20 operations like transfer, approve, and transferFrom", async function () {
      await group11Token.connect(owner).transfer(buyer1.address, scaleTokens(100));
      expect(await group11Token.balanceOf(buyer1.address)).to.equal(scaleTokens(100));
      await group11Token.connect(buyer1).approve(buyer2.address, scaleTokens(50));
      expect(await group11Token.allowance(buyer1.address, buyer2.address)).to.equal(scaleTokens(50));
      await group11Token.connect(buyer2).transferFrom(buyer1.address, owner.address, scaleTokens(30));
      const expectedOwnerBalanceAfterRefund = scaleTokens(INITIAL_SUPPLY_WHOLE_TOKENS - 100 + 30);
      expect(await group11Token.balanceOf(owner.address)).to.equal(expectedOwnerBalanceAfterRefund);
      expect(await group11Token.balanceOf(buyer1.address)).to.equal(scaleTokens(70));
      expect(await group11Token.allowance(buyer1.address, buyer2.address)).to.equal(scaleTokens(20));
    });
  });


  describe("Token Sale Mechanics", function () {
    const TOKENS_FOR_SALE_PERCENT = 50;
    const totalTokensOfferedForSale = INITIAL_SUPPLY_WHOLE_TOKENS * TOKENS_FOR_SALE_PERCENT / 100;
    const tier1SaleCap = Math.floor(totalTokensOfferedForSale / 2); // Use Math.floor for whole numbers

    it("Should sell tokens at 5 ETH each while total sold is less than 25% of sale allocation", async function () {
      const tokensToBuy = 10;
      const expectedCost = PRICE_TIER_1 * BigInt(tokensToBuy); 

      await expect(group11Token.connect(buyer1).buyTokens({ value: expectedCost }))
        .to.emit(group11Token, "TokensPurchased")
        .withArgs(buyer1.address, scaleTokens(tokensToBuy), PRICE_TIER_1);

      expect(await group11Token.balanceOf(buyer1.address)).to.equal(scaleTokens(tokensToBuy));
      expect(await group11Token.totalTokensSold()).to.equal(tokensToBuy);
      expect(await group11Token.getCurrentPrice()).to.equal(PRICE_TIER_1);
    });

    it("Should switch to 10 ETH price after the first 25% of sale allocation is sold", async function () {
      // Owner buys tokens to nearly fill Tier 1, leaving a few for buyer1 to test the boundary.
      const tokensToLeaveForBoundaryTest = 2;
      const tokensToBuyByOwner = tier1SaleCap - tokensToLeaveForBoundaryTest;

      if (tokensToBuyByOwner > 0) {
          let costForOwner = PRICE_TIER_1 * BigInt(tokensToBuyByOwner);
          await group11Token.connect(owner).buyTokens({ value: costForOwner });
      }
      const soldByOwner = tokensToBuyByOwner > 0 ? tokensToBuyByOwner : 0;
      expect(await group11Token.totalTokensSold()).to.equal(soldByOwner);
      
      // Buyer1 buys the remaining tokens in Tier 1 to hit the cap exactly.
      let costForBuyer1Tier1 = PRICE_TIER_1 * BigInt(tokensToLeaveForBoundaryTest);
      await group11Token.connect(buyer1).buyTokens({ value: costForBuyer1Tier1 });
      expect(await group11Token.totalTokensSold()).to.equal(tier1SaleCap);
      
      // Price should now be Tier 2.
      expect(await group11Token.getCurrentPrice()).to.equal(PRICE_TIER_2);

      // Buyer2 makes a purchase in Tier 2.
      const tokensToBuyInTier2 = 5;
      const expectedCostTier2 = PRICE_TIER_2 * BigInt(tokensToBuyInTier2);
      await expect(group11Token.connect(buyer2).buyTokens({ value: expectedCostTier2 }))
        .to.emit(group11Token, "TokensPurchased")
        .withArgs(buyer2.address, scaleTokens(tokensToBuyInTier2), PRICE_TIER_2);
      expect(await group11Token.totalTokensSold()).to.equal(tier1SaleCap + tokensToBuyInTier2);
    });

    it("Should reject further purchases once 50% of total supply (all tokens for sale) are sold", async function () {
      // Owner buys all tokens in Tier 1.
      if (tier1SaleCap > 0) {
        await group11Token.connect(owner).buyTokens({ value: PRICE_TIER_1 * BigInt(tier1SaleCap) });
      }

      // Owner buys almost all tokens in Tier 2, leaving just one.
      const tokensRemainingForTier2 = totalTokensOfferedForSale - tier1SaleCap;
      const tokensToBuyInTier2ByOwner = tokensRemainingForTier2 - 1;
      if (tokensToBuyInTier2ByOwner > 0) {
        await group11Token.connect(owner).buyTokens({ value: PRICE_TIER_2 * BigInt(tokensToBuyInTier2ByOwner) });
      }
      
      // Buyer2 buys the very last token available in the sale.
      if (tokensRemainingForTier2 > 0) { // Ensure there was at least one token to buy
        await group11Token.connect(buyer2).buyTokens({ value: PRICE_TIER_2 * 1n });
      }
      expect(await group11Token.totalTokensSold()).to.equal(totalTokensOfferedForSale);

      // Buyer1 attempts to buy one more token, which should fail.
      await expect(
        group11Token.connect(buyer1).buyTokens({ value: PRICE_TIER_2 * 1n })
      ).to.be.revertedWith("All tokens for sale are sold out");
    });

    it("Should refund ETH that doesn't purchase a whole token", async function () {
      const pricePerTokenCurrentTier = PRICE_TIER_1; 
      
      const ethForOneToken = pricePerTokenCurrentTier * 1n; 
      const ethForLessThanOneToken = pricePerTokenCurrentTier / 2n; 
      const ethForOneAndAHalfTokens = ethForOneToken + ethForLessThanOneToken; 

      const initialBuyerBalance = await ethers.provider.getBalance(buyer1.address);

      const tx = await group11Token.connect(buyer1).buyTokens({ value: ethForOneAndAHalfTokens });
      const receipt = await tx.wait();
      const gasPrice = tx.gasPrice || (await ethers.provider.getFeeData()).gasPrice; 
      const gasUsed = BigInt(receipt.gasUsed.toString()); 
      const gasCost = gasUsed * gasPrice; 

      expect(await group11Token.balanceOf(buyer1.address)).to.equal(scaleTokens(1));
      const expectedFinalBalance = initialBuyerBalance - ethForOneToken - gasCost; 
      expect(await ethers.provider.getBalance(buyer1.address)).to.equal(expectedFinalBalance);
    });

    it("Should end the token sale after 30 days", async function () {
      await ethers.provider.send("evm_increaseTime", [SALE_DURATION_SECONDS + 60]);
      await ethers.provider.send("evm_mine");

      await expect(
        group11Token.connect(buyer1).buyTokens({ value: PRICE_TIER_1 * 1n }) 
      ).to.be.revertedWith("Sale ended due to time limit");
    });

    it("Should allow plain ETH transfer to invoke buyTokens() via receive function", async function () {
      const tokensToBuy = 2;
      const cost = PRICE_TIER_1 * BigInt(tokensToBuy); 

      await expect(buyer1.sendTransaction({ to: group11Token.target, value: cost }))
        .to.emit(group11Token, "TokensPurchased")
        .withArgs(buyer1.address, scaleTokens(tokensToBuy), PRICE_TIER_1);
      
      expect(await group11Token.balanceOf(buyer1.address)).to.equal(scaleTokens(tokensToBuy));
    });
  });

  describe("Owner Privileges", function () {
    it("Should let the owner withdraw ETH proceeds from the sale", async function () {
      const purchaseAmount = PRICE_TIER_1 * 20n; 
      await group11Token.connect(buyer1).buyTokens({ value: purchaseAmount });

      const contractEthBalanceBeforeWithdraw = await ethers.provider.getBalance(group11Token.target);
      expect(contractEthBalanceBeforeWithdraw).to.equal(purchaseAmount);

      const ownerEthBalanceBeforeWithdraw = await ethers.provider.getBalance(owner.address);
      
      const tx = await group11Token.connect(owner).withdrawETH();
      const receipt = await tx.wait();
      const gasPrice = tx.gasPrice || (await ethers.provider.getFeeData()).gasPrice; 
      const gasUsed = BigInt(receipt.gasUsed.toString()); 
      const gasCost = gasUsed * gasPrice; 

      expect(await ethers.provider.getBalance(group11Token.target)).to.equal(0n); 
      expect(await ethers.provider.getBalance(owner.address)).to.equal(ownerEthBalanceBeforeWithdraw + purchaseAmount - gasCost); 
    });

    it("Should prevent non-owners from withdrawing ETH", async function() {
        await group11Token.connect(buyer1).buyTokens({ value: PRICE_TIER_1 * 1n }); 
        await expect(group11Token.connect(buyer1).withdrawETH()) 
            .to.be.revertedWith("Only owner can withdraw ETH");
    });
  });
});