// 검증 데이터
const verificationData = {
  "verification_stages": [
    {
      "id": 1,
      "name": "AI 한계 극복",
      "description": "Claude 1차 검증에서 놓칠 수 있는 논리적 오류와 복잡한 상호작용 검증",
      "color": "#ef4444",
      "items": [
        {
          "id": 1,
          "component": "SmartIndexVault.sol",
          "title": "ERC-4626 호환성의 미묘한 오류",
          "priority": "Critical",
          "method": "수동 검증",
          "description": "shares/assets 계산 로직의 정확성 수동 검증",
          "status": "pending",
          "notes": ""
        },
        {
          "id": 2,
          "component": "SmartIndexVault.sol", 
          "title": "리밸런싱 로직의 경제적 합리성",
          "priority": "High",
          "method": "비즈니스 로직 분석",
          "description": "경제학적 관점에서 리밸런싱 전략 검증",
          "status": "pending",
          "notes": ""
        },
        {
          "id": 3,
          "component": "MultiDEXAggregator.sol",
          "title": "복잡한 DEX 라우팅 최적화",
          "priority": "Critical",
          "method": "수동 검증",
          "description": "다중 홉 라우팅에서의 슬리피지 누적 계산",
          "status": "pending",
          "notes": ""
        },
        {
          "id": 4,
          "component": "IndexToken.sol",
          "title": "토큰 발행/소각의 원자성",
          "priority": "Critical",
          "method": "상태 변화 분석",
          "description": "상태 변화 순서와 일관성 수동 검증",
          "status": "pending",
          "notes": ""
        },
        {
          "id": 5,
          "component": "LayerZeroMessaging.sol",
          "title": "크로스체인 메시지 순서 의존성",
          "priority": "High",
          "method": "시퀀스 분석",
          "description": "메시지 순서와 타이밍 의존성 검증",
          "status": "pending",
          "notes": ""
        }
      ]
    },
    {
      "id": 2,
      "name": "전문가 수동 검증",
      "description": "인간 전문가만이 수행할 수 있는 고급 보안 분석",
      "color": "#f59e0b",
      "items": [
        {
          "id": 6,
          "component": "전체 시스템",
          "title": "가격 오라클 조작 저항성",
          "priority": "Critical",
          "method": "경제적 공격 분석",
          "description": "Hyperliquid 오라클의 조작 가능성과 방어 메커니즘",
          "status": "pending",
          "notes": ""
        },
        {
          "id": 7,
          "component": "SmartIndexVault.sol",
          "title": "수익률 계산의 정확성",
          "priority": "Critical",
          "method": "수학적 검증",
          "description": "compound interest와 fee 구조의 수학적 정확성",
          "status": "pending",
          "notes": ""
        },
        {
          "id": 8,
          "component": "MultiDEXAggregator.sol",
          "title": "MEV 공격 방어 로직",
          "priority": "High",
          "method": "MEV 분석",
          "description": "샌드위치 공격과 프론트러닝 방어 메커니즘",
          "status": "pending",
          "notes": ""
        },
        {
          "id": 9,
          "component": "RedemptionManager.sol",
          "title": "대량 상환 시 유동성 위험",
          "priority": "High",
          "method": "시나리오 테스팅",
          "description": "뱅크런 상황에서의 시스템 안정성",
          "status": "pending",
          "notes": ""
        },
        {
          "id": 10,
          "component": "전체 시스템",
          "title": "거버넌스 토큰 경제학",
          "priority": "Medium",
          "method": "토큰이코노믹스 분석",
          "description": "인센티브 구조와 게임 이론적 안정성",
          "status": "pending",
          "notes": ""
        }
      ]
    },
    {
      "id": 3,
      "name": "도구 조합 검증",
      "description": "여러 보안 도구를 조합한 포괄적 취약점 분석",
      "color": "#8b5cf6",
      "items": [
        {
          "id": 11,
          "component": "SmartIndexVault.sol",
          "title": "재진입 공격 완전 검증",
          "priority": "Critical",
          "method": "Slither + Mythril + 수동",
          "description": "모든 외부 호출 지점에서의 재진입 가능성",
          "status": "pending",
          "notes": ""
        },
        {
          "id": 12,
          "component": "MultiDEXAggregator.sol",
          "title": "정수 오버플로우/언더플로우",
          "priority": "High",
          "method": "MythX + Echidna",
          "description": "극한값에서의 계산 안전성 퍼징 테스트",
          "status": "pending",
          "notes": ""
        },
        {
          "id": 13,
          "component": "IndexToken.sol",
          "title": "접근 제어 우회 가능성",
          "priority": "Critical",
          "method": "Manticore + 수동",
          "description": "심볼릭 실행으로 모든 실행 경로 검증",
          "status": "pending",
          "notes": ""
        },
        {
          "id": 14,
          "component": "전체 시스템",
          "title": "가스 한계 DoS 공격",
          "priority": "Medium",
          "method": "가스 분석 도구",
          "description": "블록 가스 한계 내에서의 실행 보장",
          "status": "pending",
          "notes": ""
        },
        {
          "id": 15,
          "component": "LayerZeroMessaging.sol",
          "title": "크로스체인 메시지 검증",
          "priority": "High",
          "method": "통합 테스트 도구",
          "description": "실제 크로스체인 환경에서의 메시지 무결성",
          "status": "pending",
          "notes": ""
        }
      ]
    },
    {
      "id": 4,
      "name": "커뮤니티 검증",
      "description": "커뮤니티와 외부 전문가를 통한 집단 지성 활용",
      "color": "#06b6d4",
      "items": [
        {
          "id": 16,
          "component": "전체 프로젝트",
          "title": "코드 품질 피어 리뷰",
          "priority": "Medium",
          "method": "GitHub 리뷰",
          "description": "경험있는 Solidity 개발자들의 코드 리뷰",
          "status": "pending",
          "notes": ""
        },
        {
          "id": 17,
          "component": "SmartIndexVault.sol",
          "title": "ERC-4626 표준 준수 검증",
          "priority": "High",
          "method": "커뮤니티 표준 검증",
          "description": "ERC-4626 커뮤니티의 표준 준수 검증",
          "status": "pending",
          "notes": ""
        },
        {
          "id": 18,
          "component": "전체 시스템",
          "title": "버그 바운티 프로그램",
          "priority": "Critical",
          "method": "화이트햇 해커",
          "description": "실제 해킹 시도를 통한 취약점 발견",
          "status": "pending",
          "notes": ""
        },
        {
          "id": 19,
          "component": "MultiDEXAggregator.sol",
          "title": "MEV 봇 개발자 리뷰",
          "priority": "High",
          "method": "MEV 전문가",
          "description": "MEV 봇 개발자들의 공격 벡터 분석",
          "status": "pending",
          "notes": ""
        },
        {
          "id": 20,
          "component": "전체 프로젝트",
          "title": "외부 감사 기관 검증",
          "priority": "Critical",
          "method": "전문 감사사",
          "description": "OpenZeppelin, ConsenSys Diligence 등",
          "status": "pending",
          "notes": ""
        }
      ]
    },
    {
      "id": 5,
      "name": "실전 테스팅",
      "description": "실제 환경에서의 극한 상황 시뮬레이션과 공격 시나리오 테스트",
      "color": "#10b981",
      "items": [
        {
          "id": 21,
          "component": "SmartIndexVault.sol",
          "title": "극한 시장 조건 테스팅",
          "priority": "Critical",
          "method": "시장 시뮬레이션",
          "description": "2008년, 2020년 수준의 시장 크래시 시뮬레이션",
          "status": "pending",
          "notes": ""
        },
        {
          "id": 22,
          "component": "MultiDEXAggregator.sol",
          "title": "네트워크 정체 상황 테스팅",
          "priority": "High",
          "method": "네트워크 시뮬레이션",
          "description": "높은 가스비와 트랜잭션 지연 상황 테스트",
          "status": "pending",
          "notes": ""
        },
        {
          "id": 23,
          "component": "IndexToken.sol",
          "title": "대량 매매 시나리오",
          "priority": "High",
          "method": "볼륨 테스팅",
          "description": "총 공급량의 50% 이상 거래 시나리오",
          "status": "pending",
          "notes": ""
        },
        {
          "id": 24,
          "component": "전체 시스템",
          "title": "Hyperliquid 네트워크 특성",
          "priority": "Critical",
          "method": "네트워크별 테스팅",
          "description": "Hyperliquid EVM 호환성과 성능 특성 검증",
          "status": "pending",
          "notes": ""
        },
        {
          "id": 25,
          "component": "LayerZeroMessaging.sol",
          "title": "크로스체인 브리지 공격",
          "priority": "Critical",
          "method": "브리지 공격 시뮬레이션",
          "description": "실제 브리지 해킹 사례 재현 테스트",
          "status": "pending",
          "notes": ""
        }
      ]
    }
  ]
};

// 전역 변수
let currentModalItem = null;
let allItems = [];
let overallProgressChart = null;
let stageProgressChart = null;
let priorityChart = null;

// 상태 텍스트 매핑
const statusTexts = {
    pending: '대기중',
    'in-progress': '진행중',
    completed: '완료'
};

// 우선순위별 상태 순환
const statusCycle = ['pending', 'in-progress', 'completed'];

// DOM 로드 완료 후 초기화
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // 모든 아이템을 플랫 배열로 저장
    allItems = verificationData.verification_stages.flatMap(stage => 
        stage.items.map(item => ({ ...item, stageId: stage.id, stageName: stage.name }))
    );
    
    // 이벤트 리스너 설정
    setupEventListeners();
    
    // 초기 렌더링
    renderChecklist();
    updateProgress();
    initializeCharts();
}

function setupEventListeners() {
    // 탭 네비게이션
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const tabName = this.dataset.tab;
            switchTab(tabName);
        });
    });
    
    // 필터 이벤트
    document.getElementById('stageFilter').addEventListener('change', renderChecklist);
    document.getElementById('priorityFilter').addEventListener('change', renderChecklist);
    document.getElementById('componentFilter').addEventListener('change', renderChecklist);
    
    // 모달 이벤트
    const modal = document.getElementById('itemModal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === this) closeModal();
        });
    }
    
    const modalClose = document.querySelector('.modal-close');
    if (modalClose) {
        modalClose.addEventListener('click', closeModal);
    }
    
    const modalCloseBtn = document.getElementById('modalClose');
    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', closeModal);
    }
    
    const toggleStatusBtn = document.getElementById('toggleStatus');
    if (toggleStatusBtn) {
        toggleStatusBtn.addEventListener('click', toggleItemStatus);
    }
    
    const saveNotesBtn = document.getElementById('saveNotes');
    if (saveNotesBtn) {
        saveNotesBtn.addEventListener('click', saveItemNotes);
    }
    
    // 단계 카드 클릭 이벤트
    document.querySelectorAll('.stage-card').forEach(card => {
        card.addEventListener('click', function() {
            const stageId = this.dataset.stageId;
            document.getElementById('stageFilter').value = stageId;
            switchTab('checklist');
            renderChecklist();
        });
    });
}

function switchTab(tabName) {
    // 탭 버튼 활성화
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    // 탭 콘텐츠 표시/숨김
    document.querySelectorAll('.tab-content').forEach(content => {
        if (content.id === tabName) {
            content.classList.remove('hidden');
        } else {
            content.classList.add('hidden');
        }
    });
    
    // 진행 상황 탭이면 차트 업데이트
    if (tabName === 'progress') {
        updateProgressCharts();
    }
}

function renderChecklist() {
    const stageFilter = document.getElementById('stageFilter').value;
    const priorityFilter = document.getElementById('priorityFilter').value;
    const componentFilter = document.getElementById('componentFilter').value;
    
    let filteredItems = allItems;
    
    // 필터 적용
    if (stageFilter !== 'all') {
        filteredItems = filteredItems.filter(item => item.stageId === parseInt(stageFilter));
    }
    
    if (priorityFilter !== 'all') {
        filteredItems = filteredItems.filter(item => item.priority === priorityFilter);
    }
    
    if (componentFilter !== 'all') {
        filteredItems = filteredItems.filter(item => item.component === componentFilter);
    }
    
    // 체크리스트 렌더링
    const container = document.getElementById('checklistItems');
    container.innerHTML = '';
    
    filteredItems.forEach(item => {
        const itemElement = createChecklistItem(item);
        container.appendChild(itemElement);
    });
}

function createChecklistItem(item) {
    const div = document.createElement('div');
    div.className = 'checklist-item';
    div.innerHTML = `
        <div class="checklist-header">
            <div class="checkbox-container">
                <input type="checkbox" class="checkbox" ${item.status === 'completed' ? 'checked' : ''} 
                       data-item-id="${item.id}">
            </div>
            <div class="item-content">
                <h3 class="item-title" data-item-id="${item.id}">${item.title}</h3>
                <div class="item-meta">
                    <span class="meta-item"><strong>단계:</strong> ${item.stageName}</span>
                    <span class="meta-item"><strong>컴포넌트:</strong> ${item.component}</span>
                    <span class="meta-item"><strong>방법:</strong> ${item.method}</span>
                    <span class="priority-badge ${item.priority}">${item.priority}</span>
                    <span class="status ${item.status}">${statusTexts[item.status]}</span>
                </div>
                <p class="item-description">${item.description}</p>
            </div>
        </div>
    `;
    
    // 이벤트 리스너 추가
    const checkbox = div.querySelector('.checkbox');
    checkbox.addEventListener('change', function() {
        toggleItemComplete(parseInt(this.dataset.itemId));
    });
    
    const title = div.querySelector('.item-title');
    title.addEventListener('click', function() {
        openItemModal(parseInt(this.dataset.itemId));
    });
    
    return div;
}

function toggleItemComplete(itemId) {
    const item = allItems.find(i => i.id === itemId);
    if (item) {
        item.status = item.status === 'completed' ? 'pending' : 'completed';
        renderChecklist();
        updateProgress();
    }
}

function openItemModal(itemId) {
    currentModalItem = allItems.find(i => i.id === itemId);
    if (!currentModalItem) return;
    
    // 모달 내용 채우기
    const modalTitle = document.getElementById('modalTitle');
    const modalComponent = document.getElementById('modalComponent');
    const modalPriority = document.getElementById('modalPriority');
    const modalMethod = document.getElementById('modalMethod');
    const modalStatus = document.getElementById('modalStatus');
    const modalDescription = document.getElementById('modalDescription');
    const modalNotes = document.getElementById('modalNotes');
    
    if (modalTitle) modalTitle.textContent = currentModalItem.title;
    if (modalComponent) modalComponent.textContent = currentModalItem.component;
    if (modalPriority) {
        modalPriority.textContent = currentModalItem.priority;
        modalPriority.className = `priority-badge ${currentModalItem.priority}`;
    }
    if (modalMethod) modalMethod.textContent = currentModalItem.method;
    if (modalStatus) {
        modalStatus.textContent = statusTexts[currentModalItem.status];
        modalStatus.className = `status ${currentModalItem.status}`;
    }
    if (modalDescription) modalDescription.textContent = currentModalItem.description;
    if (modalNotes) modalNotes.value = currentModalItem.notes || '';
    
    // 모달 표시
    const modal = document.getElementById('itemModal');
    if (modal) {
        modal.classList.remove('hidden');
    }
}

function closeModal() {
    const modal = document.getElementById('itemModal');
    if (modal) {
        modal.classList.add('hidden');
    }
    currentModalItem = null;
}

function toggleItemStatus() {
    if (!currentModalItem) return;
    
    const currentIndex = statusCycle.indexOf(currentModalItem.status);
    const nextIndex = (currentIndex + 1) % statusCycle.length;
    currentModalItem.status = statusCycle[nextIndex];
    
    // UI 업데이트
    const modalStatus = document.getElementById('modalStatus');
    if (modalStatus) {
        modalStatus.textContent = statusTexts[currentModalItem.status];
        modalStatus.className = `status ${currentModalItem.status}`;
    }
    
    renderChecklist();
    updateProgress();
}

function saveItemNotes() {
    if (!currentModalItem) return;
    
    const modalNotes = document.getElementById('modalNotes');
    if (modalNotes) {
        const notes = modalNotes.value;
        currentModalItem.notes = notes;
        
        // 성공 피드백 (간단한 알림)
        const saveBtn = document.getElementById('saveNotes');
        if (saveBtn) {
            const originalText = saveBtn.textContent;
            saveBtn.textContent = '저장됨!';
            saveBtn.classList.add('btn--primary');
            
            setTimeout(() => {
                saveBtn.textContent = originalText;
                saveBtn.classList.remove('btn--primary');
            }, 1500);
        }
    }
}

function updateProgress() {
    const stats = calculateStats();
    
    // 전체 통계 업데이트
    const completedCount = document.getElementById('completedCount');
    const inProgressCount = document.getElementById('inProgressCount');
    const pendingCount = document.getElementById('pendingCount');
    
    if (completedCount) completedCount.textContent = stats.completed;
    if (inProgressCount) inProgressCount.textContent = stats.inProgress;
    if (pendingCount) pendingCount.textContent = stats.pending;
    
    // 단계별 진행률 업데이트
    verificationData.verification_stages.forEach(stage => {
        const stageStats = calculateStageStats(stage.id);
        const card = document.querySelector(`[data-stage-id="${stage.id}"]`);
        if (card) {
            const progressFill = card.querySelector('.progress-fill');
            const progressText = card.querySelector('.progress-text');
            const percentage = stageStats.total > 0 ? (stageStats.completed / stageStats.total) * 100 : 0;
            
            if (progressFill) progressFill.style.width = `${percentage}%`;
            if (progressText) progressText.textContent = `${stageStats.completed}/${stageStats.total} 완료`;
        }
    });
    
    // 우선순위별 통계 업데이트
    updatePriorityStats();
    
    // 전체 진행률 차트 업데이트
    if (overallProgressChart) {
        overallProgressChart.data.datasets[0].data = [stats.completed, stats.inProgress, stats.pending];
        overallProgressChart.update();
    }
}

function calculateStats() {
    const completed = allItems.filter(item => item.status === 'completed').length;
    const inProgress = allItems.filter(item => item.status === 'in-progress').length;
    const pending = allItems.filter(item => item.status === 'pending').length;
    
    return { completed, inProgress, pending, total: allItems.length };
}

function calculateStageStats(stageId) {
    const stageItems = allItems.filter(item => item.stageId === stageId);
    const completed = stageItems.filter(item => item.status === 'completed').length;
    const inProgress = stageItems.filter(item => item.status === 'in-progress').length;
    const pending = stageItems.filter(item => item.status === 'pending').length;
    
    return { completed, inProgress, pending, total: stageItems.length };
}

function updatePriorityStats() {
    const priorities = ['Critical', 'High', 'Medium'];
    
    priorities.forEach(priority => {
        const items = allItems.filter(item => item.priority === priority);
        const completed = items.filter(item => item.status === 'completed').length;
        const total = items.length;
        
        const completedEl = document.getElementById(`${priority.toLowerCase()}Completed`);
        const totalEl = document.getElementById(`${priority.toLowerCase()}Total`);
        const progressBar = document.querySelector(`.stat-bar.${priority.toLowerCase()} .stat-progress`);
        
        if (completedEl && totalEl && progressBar) {
            completedEl.textContent = completed;
            totalEl.textContent = total;
            const percentage = total > 0 ? (completed / total) * 100 : 0;
            progressBar.style.width = `${percentage}%`;
        }
    });
}

function initializeCharts() {
    // 전체 진행률 도넛 차트
    const overallCanvas = document.getElementById('overallProgressChart');
    if (overallCanvas) {
        const overallCtx = overallCanvas.getContext('2d');
        const stats = calculateStats();
        
        overallProgressChart = new Chart(overallCtx, {
            type: 'doughnut',
            data: {
                labels: ['완료', '진행중', '대기중'],
                datasets: [{
                    data: [stats.completed, stats.inProgress, stats.pending],
                    backgroundColor: ['#1FB8CD', '#FFC185', '#B4413C'],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    }
                }
            }
        });
    }
}

function updateProgressCharts() {
    // 단계별 진행률 바 차트
    const stageCanvas = document.getElementById('stageProgressChart');
    if (stageCanvas) {
        const stageCtx = stageCanvas.getContext('2d');
        const stageLabels = verificationData.verification_stages.map(stage => stage.name);
        const stageData = verificationData.verification_stages.map(stage => {
            const stats = calculateStageStats(stage.id);
            return stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;
        });
        
        if (stageProgressChart) {
            stageProgressChart.destroy();
        }
        
        stageProgressChart = new Chart(stageCtx, {
            type: 'bar',
            data: {
                labels: stageLabels,
                datasets: [{
                    label: '완료율 (%)',
                    data: stageData,
                    backgroundColor: ['#1FB8CD', '#FFC185', '#B4413C', '#ECEBD5', '#5D878F'],
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }
    
    // 우선순위별 도넛 차트
    const priorityCanvas = document.getElementById('priorityChart');
    if (priorityCanvas) {
        const priorityCtx = priorityCanvas.getContext('2d');
        const priorities = ['Critical', 'High', 'Medium'];
        const priorityData = priorities.map(priority => {
            return allItems.filter(item => item.priority === priority).length;
        });
        
        if (priorityChart) {
            priorityChart.destroy();
        }
        
        priorityChart = new Chart(priorityCtx, {
            type: 'doughnut',
            data: {
                labels: priorities,
                datasets: [{
                    data: priorityData,
                    backgroundColor: ['#DB4545', '#D2BA4C', '#964325'],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    }
                }
            }
        });
    }
}