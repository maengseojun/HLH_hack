const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("IndexToken", function () {
    async function deployIndexTokenFixture() {
        const [owner, factory, user1, user2] = await ethers.getSigners();
        
        const fundId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test-fund"));
        
        // Deploy IndexToken
        const IndexToken = await ethers.getContractFactory("IndexToken");
        const indexToken = await IndexToken.deploy(
            "Test Index Token",
            "TEST",
            fundId,
            factory.address
        );
        await indexToken.deployed();
        
        return {
            indexToken,
            fundId,
            owner,
            factory,
            user1,
            user2
        };
    }
    
    describe("Deployment", function () {
        it("Should deploy with correct initial parameters", async function () {
            const { indexToken, fundId, factory } = await loadFixture(deployIndexTokenFixture);
            
            expect(await indexToken.name()).to.equal("Test Index Token");
            expect(await indexToken.symbol()).to.equal("TEST");
            expect(await indexToken.fundId()).to.equal(fundId);
            expect(await indexToken.factory()).to.equal(factory.address);
            expect(await indexToken.owner()).to.equal(factory.address);
            expect(await indexToken.totalSupply()).to.equal(0);
        });
        
        it("Should not deploy with zero addresses", async function () {
            const IndexToken = await ethers.getContractFactory("IndexToken");
            const fundId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test-fund"));
            
            await expect(
                IndexToken.deploy("Test", "TEST", fundId, ethers.constants.AddressZero)
            ).to.be.revertedWith("Factory address cannot be zero");
            
            await expect(
                IndexToken.deploy("Test", "TEST", ethers.constants.HashZero, ethers.constants.AddressZero)
            ).to.be.revertedWith("Fund ID cannot be zero");
        });
    });
    
    describe("Minting and Burning", function () {
        it("Should allow factory to mint tokens", async function () {
            const { indexToken, factory, user1 } = await loadFixture(deployIndexTokenFixture);
            
            const mintAmount = ethers.utils.parseEther("1000");
            
            await expect(
                indexToken.connect(factory).mint(user1.address, mintAmount)
            ).to.emit(indexToken, "Transfer")
            .withArgs(ethers.constants.AddressZero, user1.address, mintAmount);
            
            expect(await indexToken.balanceOf(user1.address)).to.equal(mintAmount);
            expect(await indexToken.totalSupply()).to.equal(mintAmount);
        });
        
        it("Should not allow non-factory to mint tokens", async function () {
            const { indexToken, user1, user2 } = await loadFixture(deployIndexTokenFixture);
            
            const mintAmount = ethers.utils.parseEther("1000");
            
            await expect(
                indexToken.connect(user1).mint(user2.address, mintAmount)
            ).to.be.revertedWith("Only factory can call");
        });
        
        it("Should allow factory to burn tokens", async function () {
            const { indexToken, factory, user1 } = await loadFixture(deployIndexTokenFixture);
            
            const mintAmount = ethers.utils.parseEther("1000");
            const burnAmount = ethers.utils.parseEther("400");
            
            // First mint some tokens
            await indexToken.connect(factory).mint(user1.address, mintAmount);
            
            // Then burn some
            await expect(
                indexToken.connect(factory).burn(user1.address, burnAmount)
            ).to.emit(indexToken, "Transfer")
            .withArgs(user1.address, ethers.constants.AddressZero, burnAmount);
            
            expect(await indexToken.balanceOf(user1.address)).to.equal(mintAmount.sub(burnAmount));
            expect(await indexToken.totalSupply()).to.equal(mintAmount.sub(burnAmount));
        });
        
        it("Should not allow non-factory to burn tokens", async function () {
            const { indexToken, factory, user1, user2 } = await loadFixture(deployIndexTokenFixture);
            
            const mintAmount = ethers.utils.parseEther("1000");
            const burnAmount = ethers.utils.parseEther("400");
            
            // First mint some tokens
            await indexToken.connect(factory).mint(user1.address, mintAmount);
            
            // Try to burn as non-factory
            await expect(
                indexToken.connect(user2).burn(user1.address, burnAmount)
            ).to.be.revertedWith("Only factory can call");
        });
    });
    
    describe("ERC20 Functionality", function () {
        beforeEach(async function () {
            const { indexToken, factory, user1, user2 } = await loadFixture(deployIndexTokenFixture);
            
            // Mint some tokens to user1
            const mintAmount = ethers.utils.parseEther("1000");
            await indexToken.connect(factory).mint(user1.address, mintAmount);
            
            this.indexToken = indexToken;
            this.factory = factory;
            this.user1 = user1;
            this.user2 = user2;
            this.mintAmount = mintAmount;
        });
        
        it("Should allow token transfers", async function () {
            const transferAmount = ethers.utils.parseEther("100");
            
            await expect(
                this.indexToken.connect(this.user1).transfer(this.user2.address, transferAmount)
            ).to.emit(this.indexToken, "Transfer")
            .withArgs(this.user1.address, this.user2.address, transferAmount);
            
            expect(await this.indexToken.balanceOf(this.user1.address)).to.equal(
                this.mintAmount.sub(transferAmount)
            );
            expect(await this.indexToken.balanceOf(this.user2.address)).to.equal(transferAmount);
        });
        
        it("Should allow approvals and transferFrom", async function () {
            const approvalAmount = ethers.utils.parseEther("200");
            const transferAmount = ethers.utils.parseEther("100");
            
            // Approve user2 to spend user1's tokens
            await this.indexToken.connect(this.user1).approve(this.user2.address, approvalAmount);
            
            expect(await this.indexToken.allowance(this.user1.address, this.user2.address))
                .to.equal(approvalAmount);
            
            // Transfer using allowance
            await expect(
                this.indexToken.connect(this.user2).transferFrom(
                    this.user1.address,
                    this.user2.address,
                    transferAmount
                )
            ).to.emit(this.indexToken, "Transfer")
            .withArgs(this.user1.address, this.user2.address, transferAmount);
            
            expect(await this.indexToken.balanceOf(this.user2.address)).to.equal(transferAmount);
            expect(await this.indexToken.allowance(this.user1.address, this.user2.address))
                .to.equal(approvalAmount.sub(transferAmount));
        });
        
        it("Should not allow transfers exceeding balance", async function () {
            const excessiveAmount = this.mintAmount.add(1);
            
            await expect(
                this.indexToken.connect(this.user1).transfer(this.user2.address, excessiveAmount)
            ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
        });
    });
    
    describe("View Functions", function () {
        it("Should return correct decimals", async function () {
            const { indexToken } = await loadFixture(deployIndexTokenFixture);
            
            expect(await indexToken.decimals()).to.equal(18);
        });
        
        it("Should return correct token information", async function () {
            const { indexToken, fundId, factory } = await loadFixture(deployIndexTokenFixture);
            
            expect(await indexToken.name()).to.equal("Test Index Token");
            expect(await indexToken.symbol()).to.equal("TEST");
            expect(await indexToken.fundId()).to.equal(fundId);
            expect(await indexToken.factory()).to.equal(factory.address);
        });
    });
});
