// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "hardhat/console.sol";

contract Group11Token {
    string public constant name = "Group 11 Token";
    string public constant symbol = "GRP11";
    uint8 public constant decimals = 18;
    uint256 private _totalSupply;

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    address public owner;

    // Token Sale Campaign Parameters
    uint256 public constant MAX_SALE_PERCENT = 50; // 50% of total supply for sale
    uint256 public constant PRICE_TIER1 = 5 ether; // Price for the first 25% of tokens for sale
    uint256 public constant PRICE_TIER2 = 10 ether; // Price for the next 25% of tokens for sale
    uint256 public immutable saleStartTime;
    uint256 public constant SALE_DURATION = 30 days;
    
    uint256 public totalTokensSold; // Tracks number of tokens sold (not scaled by decimals)

    // Events
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event TokensPurchased(address indexed buyer, uint256 amount, uint256 pricePaidPerToken); // amount is scaled
    event SaleEnded(string reason);
    event ETHWithdrawn(address indexed to, uint256 amount);

    constructor(uint256 initialSupply) {
        owner = msg.sender;
        _totalSupply = initialSupply * (10**uint256(decimals));
        _balances[owner] = _totalSupply;
        emit Transfer(address(0), owner, _totalSupply);
        saleStartTime = block.timestamp;
    }

    // --- ERC20 Standard Functions ---
    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }

    function transfer(address to, uint256 amount) public virtual returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function allowance(address _owner, address spender) public view virtual returns (uint256) {
        return _allowances[_owner][spender];
    }

    function approve(address spender, uint256 amount) public virtual returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) public virtual returns (bool) {
        uint256 currentAllowance = _allowances[from][msg.sender];
        require(currentAllowance >= amount, "ERC20: transfer amount exceeds allowance");
        _transfer(from, to, amount);
        _approve(from, msg.sender, currentAllowance - amount);
        return true;
    }

    function _transfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual {
        require(from != address(0), "ERC20: transfer from the zero address");
        require(to != address(0), "ERC20: transfer to the zero address");
        require(_balances[from] >= amount, "ERC20: transfer amount exceeds balance");

        _balances[from] -= amount;
        _balances[to] += amount;
        emit Transfer(from, to, amount);
    }

    function _approve(
        address _owner,
        address spender,
        uint256 amount
    ) internal virtual {
        require(_owner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");
        _allowances[_owner][spender] = amount;
        emit Approval(_owner, spender, amount);
    }

    // --- Token Sale Campaign ---
    function getTokensAvailableForSale() public view returns (uint256) {
        // Returns actual number of tokens (not scaled)
        return (_totalSupply / (10**uint256(decimals)) * MAX_SALE_PERCENT) / 100;
    }

    function getCurrentPrice() public view returns (uint256) {
        uint256 tokensForSale = getTokensAvailableForSale();
        uint256 tier1Boundary = tokensForSale / 2; // 25% of tokens for sale means 50% of tokensForSale

        if (block.timestamp > saleStartTime + SALE_DURATION) {
            return 0; // Sale ended
        }
        if (totalTokensSold >= tokensForSale) {
            return 0; // All tokens sold
        }

        if (totalTokensSold < tier1Boundary) {
            return PRICE_TIER1;
        } else {
            return PRICE_TIER2;
        }
    }
    
    // Fallback function to accept plain ETH transfers for buying tokens
    receive() external payable {
        buyTokens();
    }

    function buyTokens() public payable {
        require(block.timestamp <= saleStartTime + SALE_DURATION, "Sale ended due to time limit");
        
        uint256 tokensForSaleTotal = getTokensAvailableForSale(); // actual token count
        require(totalTokensSold < tokensForSaleTotal, "All tokens for sale are sold out");

        uint256 currentPrice = getCurrentPrice();
        require(currentPrice > 0, "Sale is not active or price is zero"); // Should be covered by above checks

        require(msg.value > 0, "Send ETH to buy tokens");

        // Calculate how many tokens (actual count, not scaled) can be bought with msg.value
        uint256 tokensUserWantsToBuy = msg.value / currentPrice; 
        require(tokensUserWantsToBuy > 0, "Insufficient ETH for one token at current price");

        uint256 tokensRemainingInSale = tokensForSaleTotal - totalTokensSold;
        uint256 tokensToSell = tokensUserWantsToBuy;

        if (tokensToSell > tokensRemainingInSale) {
            tokensToSell = tokensRemainingInSale; // Cap at remaining tokens
        }

        uint256 costForTokensToSell = tokensToSell * currentPrice;
        uint256 refundAmount = msg.value - costForTokensToSell;

        // Convert tokensToSell to smallest unit for balance updates and transfers
        uint256 scaledTokensToSell = tokensToSell * (10**uint256(decimals));

        _balances[owner] -= scaledTokensToSell;
        _balances[msg.sender] += scaledTokensToSell;
        totalTokensSold += tokensToSell; // Update with actual token count

        emit Transfer(owner, msg.sender, scaledTokensToSell);
        emit TokensPurchased(msg.sender, scaledTokensToSell, currentPrice);

        // Refund any excess ETH
        if (refundAmount > 0) {
            payable(msg.sender).transfer(refundAmount);
        }

        // Check if sale should end now
        if (totalTokensSold >= tokensForSaleTotal) {
            emit SaleEnded("All tokens sold");
        }
        if (block.timestamp > saleStartTime + SALE_DURATION) {
             // This check is also at the top, but good to have an event if sale ends mid-transaction
            emit SaleEnded("Duration reached");
        }
    }

    function endSaleManually() public {
        require(msg.sender == owner, "Only owner can end sale manually");
        // This function might be redundant if checks in buyTokens are sufficient
        // Forcibly make currentPrice 0 by setting totalTokensSold to max
        totalTokensSold = getTokensAvailableForSale(); 
        emit SaleEnded("Manually ended by owner");
    }

    // --- Owner Functions ---
    function withdrawETH() public {
        require(msg.sender == owner, "Only owner can withdraw ETH");
        uint256 balance = address(this).balance;
        require(balance > 0, "No ETH to withdraw");
        payable(owner).transfer(balance);
        emit ETHWithdrawn(owner, balance);
    }
}