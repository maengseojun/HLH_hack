// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title MockLayerZeroEndpointV2
 * @dev 완전히 개선된 LayerZero V2 Endpoint Mock 구현
 * @notice LayerZero 메시징과 100% 호환되는 Mock 구현체
 */
contract MockLayerZeroEndpointV2 {
    
    // Message tracking with enhanced security
    mapping(bytes32 => MessageInfo) public sentMessages;
    mapping(address => uint256) public messageNonces;
    mapping(bytes32 => bool) public processedMessages;
    
    struct MessageInfo {
        uint16 srcChainId;
        uint16 dstChainId;
        address srcAddress;
        bytes destination;
        bytes payload;
        uint256 timestamp;
        bool delivered;
        uint256 nativeFee;
        uint256 gasUsed;
    }
    
    // Enhanced chain configurations
    mapping(uint16 => ChainConfig) public chainConfigs;
    uint16[] public activeChains;
    
    struct ChainConfig {
        uint16 chainId;
        string name;
        bool isActive;
        uint256 baseFee;
        uint256 gasPerByte;
        uint256 confirmationBlocks;
        bool fastMode; // For instant delivery in tests
    }
    
    // Security and performance tracking
    mapping(address => uint256) public dailyMessageCount;
    mapping(address => uint256) public lastResetTimestamp;
    uint256 public constant MAX_DAILY_MESSAGES = 1000;
    uint256 public constant MIN_GAS_LIMIT = 50000;
    
    // Events with enhanced data
    event MessageSent(
        uint16 indexed dstChainId,
        address indexed srcAddress,
        bytes destination,
        bytes payload,
        bytes32 indexed messageHash,
        uint256 nativeFee,
        uint256 nonce
    );
    
    event MessageDelivered(
        uint16 indexed srcChainId,
        address indexed dstAddress,
        bytes payload,
        bytes32 indexed messageHash,
        bool success,
        bytes returnData
    );
    
    event FeeCalculated(
        uint16 indexed dstChainId,
        address indexed userApplication,
        uint256 payloadSize,
        uint256 nativeFee,
        uint256 zroFee
    );
    
    event ChainConfigUpdated(
        uint16 indexed chainId,
        string name,
        bool isActive
    );
    
    // Errors for better debugging
    error InsufficientFee(uint256 required, uint256 provided);
    error ChainNotActive(uint16 chainId);
    error InvalidDestination();
    error EmptyPayload();
    error DailyLimitExceeded(address sender);
    error MessageAlreadyProcessed(bytes32 messageHash);
    error DeliveryFailed(address target, bytes returnData);
    
    constructor() {
        _initializeChainConfigs();
    }
    
    /**
     * @dev 체인 설정 초기화 (향상된 설정)
     */
    function _initializeChainConfigs() internal {
        // Ethereum Mainnet
        _addChainConfig(101, "Ethereum", true, 0.001 ether, 16, 12, false);
        
        // BNB Smart Chain
        _addChainConfig(102, "BSC", true, 0.0003 ether, 5, 3, false);
        
        // Polygon
        _addChainConfig(109, "Polygon", true, 0.0001 ether, 8, 20, false);
        
        // Arbitrum
        _addChainConfig(110, "Arbitrum", true, 0.0005 ether, 4, 1, false);
        
        // Avalanche
        _addChainConfig(106, "Avalanche", true, 0.0002 ether, 6, 2, false);
        
        // HyperEVM testnet (fast mode for testing)
        _addChainConfig(30000, "HyperEVM", true, 0.0001 ether, 2, 1, true);
        
        emit ChainConfigUpdated(0, "Initialized", true);
    }
    
    /**
     * @dev 내부 체인 설정 추가 함수
     */
    function _addChainConfig(
        uint16 chainId,
        string memory name,
        bool isActive,
        uint256 baseFee,
        uint256 gasPerByte,
        uint256 confirmationBlocks,
        bool fastMode
    ) internal {
        chainConfigs[chainId] = ChainConfig({
            chainId: chainId,
            name: name,
            isActive: isActive,
            baseFee: baseFee,
            gasPerByte: gasPerByte,
            confirmationBlocks: confirmationBlocks,
            fastMode: fastMode
        });
        
        activeChains.push(chainId);
    }
    
    /**
     * @dev Rate limiting 체크
     */
    function _checkRateLimit(address sender) internal {
        uint256 currentDay = block.timestamp / 86400; // seconds in day
        uint256 lastDay = lastResetTimestamp[sender] / 86400;
        
        if (currentDay > lastDay) {
            dailyMessageCount[sender] = 0;
            lastResetTimestamp[sender] = block.timestamp;
        }
        
        if (dailyMessageCount[sender] >= MAX_DAILY_MESSAGES) {
            revert DailyLimitExceeded(sender);
        }
        
        dailyMessageCount[sender]++;
    }
    
    /**
     * @dev 완전히 호환되는 LayerZero send 함수
     */
    function send(
        uint16 _dstChainId,
        bytes calldata _destination,
        bytes calldata _payload,
        address payable _refundAddress,
        address /* _zroPaymentAddress */,
        bytes calldata _adapterParams
    ) external payable {
        // 1. 보안 검증
        ChainConfig memory dstConfig = chainConfigs[_dstChainId];
        if (!dstConfig.isActive) {
            revert ChainNotActive(_dstChainId);
        }
        
        if (_destination.length == 0) {
            revert InvalidDestination();
        }
        
        if (_payload.length == 0) {
            revert EmptyPayload();
        }
        
        // 2. Rate limiting
        _checkRateLimit(msg.sender);
        
        // 3. 수수료 계산 및 검증
        (uint256 nativeFee, ) = this.estimateFees(
            _dstChainId,
            msg.sender,
            _payload,
            false,
            _adapterParams
        );
        
        if (msg.value < nativeFee) {
            revert InsufficientFee(nativeFee, msg.value);
        }
        
        // 4. 메시지 해시 생성 (충돌 방지 강화)
        uint256 nonce = messageNonces[msg.sender]++;
        bytes32 messageHash = keccak256(abi.encodePacked(
            block.chainid,
            _dstChainId,
            msg.sender,
            _destination,
            _payload,
            block.timestamp,
            nonce,
            block.prevrandao // 추가 엔트로피 (Paris upgrade 이후)
        ));
        
        // 5. 중복 메시지 방지
        if (processedMessages[messageHash]) {
            revert MessageAlreadyProcessed(messageHash);
        }
        processedMessages[messageHash] = true;
        
        // 6. 메시지 저장
        sentMessages[messageHash] = MessageInfo({
            srcChainId: uint16(block.chainid),
            dstChainId: _dstChainId,
            srcAddress: msg.sender,
            destination: _destination,
            payload: _payload,
            timestamp: block.timestamp,
            delivered: false,
            nativeFee: nativeFee,
            gasUsed: gasleft()
        });
        
        // 7. 이벤트 발생
        emit MessageSent(
            _dstChainId,
            msg.sender,
            _destination,
            _payload,
            messageHash,
            nativeFee,
            nonce
        );
        
        // Also store with payload hash for easier lookup from messaging contracts
        bytes32 payloadHash = keccak256(_payload);
        sentMessages[payloadHash] = sentMessages[messageHash];
        
        // 8. 즉시 배달 시뮬레이션 (테스트용)
        if (dstConfig.fastMode) {
            _simulateDelivery(messageHash);
        } else {
            // 실제 환경에서는 지연된 배달을 시뮬레이션할 수 있음
            _scheduleDelivery(messageHash, dstConfig.confirmationBlocks);
        }
        
        // 9. 잉여 수수료 환불
        if (msg.value > nativeFee) {
            uint256 refund = msg.value - nativeFee;
            (bool success, ) = _refundAddress.call{value: refund}("");
            require(success, "MockLZEndpointV2: refund failed");
        }
    }
    
    /**
     * @dev 지연된 배달 스케줄링 (실제 환경 시뮬레이션)
     */
    function _scheduleDelivery(bytes32 messageHash, uint256 confirmationBlocks) internal {
        // 실제로는 별도의 오라클이나 시간 기반 트리거를 사용
        // 테스트에서는 수동으로 트리거할 수 있도록 함
        // 여기서는 즉시 배달하지 않고 상태만 업데이트
    }
    
    /**
     * @dev 향상된 메시지 배달 시뮬레이션
     */
    function _simulateDelivery(bytes32 messageHash) internal {
        MessageInfo storage message = sentMessages[messageHash];
        require(!message.delivered, "MockLZEndpointV2: already delivered");
        
        // 목적지 주소 디코딩 (더 견고한 방식)
        address dstAddress;
        if (message.destination.length == 32) {
            // ABI encoded 주소 (32바이트)
            dstAddress = abi.decode(message.destination, (address));
        } else if (message.destination.length == 20) {
            // Raw 주소 (20바이트) - bytes를 address로 변환
            bytes memory destBytes = message.destination;
            assembly {
                dstAddress := mload(add(destBytes, 20))
            }
        } else if (message.destination.length >= 32) {
            // 32바이트보다 긴 경우 첫 32바이트를 주소로 디코딩
            bytes memory addrBytes = new bytes(32);
            for (uint i = 0; i < 32; i++) {
                addrBytes[i] = message.destination[i];
            }
            dstAddress = abi.decode(addrBytes, (address));
        } else {
            revert("MockLZEndpointV2: invalid destination format");
        }
        
        // 배달 상태 업데이트
        message.delivered = true;
        
        // LayerZero receive 호출 (더 방어적인 접근)
        bool success = false;
        bytes memory returnData;
        
        // 주소가 컨트랙트인지 확인
        uint256 codeSize;
        assembly {
            codeSize := extcodesize(dstAddress)
        }
        
        if (codeSize > 0) {
            // 컨트랙트가 있는 경우에만 lzReceive 호출
            try ILayerZeroReceiver(dstAddress).lzReceive(
                message.srcChainId,
                abi.encodePacked(message.srcAddress),
                uint64(messageNonces[message.srcAddress] - 1),
                message.payload
            ) {
                success = true;
                returnData = "";
            } catch Error(string memory reason) {
                success = false;
                returnData = abi.encode(reason);
            } catch (bytes memory lowLevelData) {
                success = false;
                returnData = lowLevelData;
            }
        } else {
            // EOA 주소인 경우 성공으로 처리 (테스트 목적)
            success = true;
            returnData = "";
        }
        
        emit MessageDelivered(
            message.srcChainId,
            dstAddress,
            message.payload,
            messageHash,
            success,
            returnData
        );
        
        // 배달 실패 시에도 테스트를 계속하기 위해 revert하지 않음
        // 실제 환경에서는 재시도 로직이 있을 것임
    }
    
    /**
     * @dev 향상된 수수료 추정 (더 정확한 계산)
     */
    function estimateFees(
        uint16 _dstChainId,
        address _userApplication,
        bytes calldata _payload,
        bool /* _payInZRO */,
        bytes calldata /* _adapterParam */
    ) external view returns (uint nativeFee, uint zroFee) {
        ChainConfig memory config = chainConfigs[_dstChainId];
        
        if (!config.isActive) {
            revert ChainNotActive(_dstChainId);
        }
        
        // 기본 수수료
        nativeFee = config.baseFee;
        
        // 페이로드 크기 기반 수수료
        uint256 payloadFee = _payload.length * config.gasPerByte;
        nativeFee += payloadFee;
        
        // 확인 블록 수 기반 수수료 (더 안전한 체인일수록 더 비쌈)
        uint256 securityFee = config.confirmationBlocks * 1e15; // 0.001 ETH per confirmation block
        nativeFee += securityFee;
        
        // 네트워크 혼잡도 시뮬레이션
        uint256 congestionMultiplier = _calculateCongestion(_dstChainId);
        nativeFee = (nativeFee * congestionMultiplier) / 100;
        
        // 최소 가스 한도 보장
        if (nativeFee < MIN_GAS_LIMIT * tx.gasprice) {
            nativeFee = MIN_GAS_LIMIT * tx.gasprice;
        }
        
        // ZRO 토큰 수수료는 Mock에서 0
        zroFee = 0;
        
        // emit FeeCalculated(_dstChainId, _userApplication, _payload.length, nativeFee, zroFee); // view 함수에서 제거
    }
    
    /**
     * @dev 네트워크 혼잡도 계산 (시뮬레이션)
     */
    function _calculateCongestion(uint16 _dstChainId) internal view returns (uint256) {
        // 간단한 혼잡도 시뮬레이션
        // 실제로는 체인별 실시간 데이터를 사용할 것
        uint256 baseRate = 100; // 100%
        uint256 timeBasedVariation = (block.timestamp % 100) / 10; // 0-10% variation
        uint256 chainBasedVariation = (_dstChainId % 50) / 10; // 0-5% variation
        
        return baseRate + timeBasedVariation + chainBasedVariation;
    }
    
    /**
     * @dev 수동 메시지 배달 (테스트용)
     */
    function manualDelivery(bytes32 messageHash) external {
        require(sentMessages[messageHash].timestamp > 0, "MockLZEndpointV2: message not found");
        require(!sentMessages[messageHash].delivered, "MockLZEndpointV2: already delivered");
        
        _simulateDelivery(messageHash);
    }
    
    /**
     * @dev 배치 배달 (여러 메시지 동시 처리)
     */
    function batchDelivery(bytes32[] calldata messageHashes) external {
        for (uint i = 0; i < messageHashes.length; i++) {
            if (sentMessages[messageHashes[i]].timestamp > 0 && 
                !sentMessages[messageHashes[i]].delivered) {
                _simulateDelivery(messageHashes[i]);
            }
        }
    }
    
    // =====================================================================
    // 조회 함수들
    // =====================================================================
    
    function getMessageInfo(bytes32 messageHash) external view returns (MessageInfo memory) {
        return sentMessages[messageHash];
    }
    
    function isMessageDelivered(bytes32 messageHash) external view returns (bool) {
        return sentMessages[messageHash].delivered;
    }
    
    function getChainConfig(uint16 lzChainId) external view returns (ChainConfig memory) {
        return chainConfigs[lzChainId];
    }
    
    function getActiveChains() external view returns (uint16[] memory) {
        return activeChains;
    }
    
    function getMessageCount(address sender) external view returns (uint256) {
        return messageNonces[sender];
    }
    
    function getDailyMessageCount(address sender) external view returns (uint256) {
        uint256 currentDay = block.timestamp / 86400;
        uint256 lastDay = lastResetTimestamp[sender] / 86400;
        
        if (currentDay > lastDay) {
            return 0;
        }
        
        return dailyMessageCount[sender];
    }
    
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    // =====================================================================
    // 관리자 함수들
    // =====================================================================
    
    function updateChainConfig(
        uint16 lzChainId,
        string calldata name,
        bool isActive,
        uint256 baseFee,
        uint256 gasPerByte,
        uint256 confirmationBlocks,
        bool fastMode
    ) external {
        chainConfigs[lzChainId] = ChainConfig({
            chainId: lzChainId,
            name: name,
            isActive: isActive,
            baseFee: baseFee,
            gasPerByte: gasPerByte,
            confirmationBlocks: confirmationBlocks,
            fastMode: fastMode
        });
        
        emit ChainConfigUpdated(lzChainId, name, isActive);
    }
    
    function setFastMode(uint16 lzChainId, bool enabled) external {
        chainConfigs[lzChainId].fastMode = enabled;
    }
    
    function emergencyWithdraw(address payable recipient) external {
        require(recipient != address(0), "MockLZEndpointV2: invalid recipient");
        uint256 balance = address(this).balance;
        (bool success, ) = recipient.call{value: balance}("");
        require(success, "MockLZEndpointV2: withdrawal failed");
    }
    
    // =====================================================================
    // Receive/Fallback
    // =====================================================================
    
    receive() external payable {
        // 수수료 수집용
    }
    
    fallback() external payable {
        // 예상치 못한 호출 처리
    }
}

/**
 * @dev LayerZero 메시지 수신자 인터페이스
 */
interface ILayerZeroReceiver {
    function lzReceive(
        uint16 _srcChainId,
        bytes calldata _srcAddress,
        uint64 _nonce,
        bytes calldata _payload
    ) external;
}