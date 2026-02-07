"""
iUM 평가 데이터셋 생성 스크립트

이 스크립트는 iUM 학습 플랫폼의 RAG 시스템을 평가하기 위한 
샘플 데이터셋을 생성합니다.

실행 방법:
    cd apps/api
    python scripts/create_evaluation_dataset.py

필요 환경변수:
    OPIK_API_KEY - Opik API 키
    OPIK_WORKSPACE - Opik 워크스페이스
"""

import os
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv()

# iUM 학습 플랫폼에 맞는 평가 데이터셋
IUM_EVALUATION_DATASET = [
    # ============ 수학 관련 질문 ============
    {
        "input": "미분의 정의를 설명해주세요",
        "expected_output": "미분은 함수의 순간 변화율을 나타내는 개념입니다. 수학적으로 f'(x) = lim(h→0) [f(x+h) - f(x)] / h 로 정의됩니다.",
        "category": "math",
        "difficulty": "medium"
    },
    {
        "input": "적분과 미분의 관계는 무엇인가요?",
        "expected_output": "미적분학의 기본정리에 따르면, 적분과 미분은 서로 역연산 관계입니다. 함수 f(x)의 부정적분 F(x)를 미분하면 다시 f(x)가 됩니다.",
        "category": "math",
        "difficulty": "medium"
    },
    {
        "input": "피타고라스 정리의 공식과 의미를 알려줘",
        "expected_output": "피타고라스 정리는 직각삼각형에서 빗변의 제곱이 다른 두 변의 제곱의 합과 같다는 정리입니다. 공식: a² + b² = c² (c는 빗변)",
        "category": "math",
        "difficulty": "easy"
    },
    
    # ============ 과학 관련 질문 ============
    {
        "input": "광합성 과정을 단계별로 설명해주세요",
        "expected_output": "광합성은 명반응과 암반응으로 나뉩니다. 명반응에서 빛 에너지로 물을 분해하여 ATP와 NADPH를 생성하고, 암반응(캘빈 회로)에서 이를 사용해 CO2를 포도당으로 전환합니다.",
        "category": "science",
        "difficulty": "medium"
    },
    {
        "input": "뉴턴의 운동 법칙 3가지를 설명해줘",
        "expected_output": "1. 관성의 법칙: 외력이 없으면 물체는 현재 상태를 유지, 2. 가속도의 법칙: F=ma, 3. 작용-반작용의 법칙: 모든 작용에 대해 크기가 같고 방향이 반대인 반작용이 존재",
        "category": "science",
        "difficulty": "easy"
    },
    {
        "input": "DNA와 RNA의 차이점은 무엇인가요?",
        "expected_output": "DNA는 이중 나선 구조, 디옥시리보스 당, 염기 A,T,G,C를 가집니다. RNA는 단일 가닥, 리보스 당, 염기 A,U,G,C를 가지며 T 대신 U를 사용합니다.",
        "category": "science",
        "difficulty": "medium"
    },
    
    # ============ 프로그래밍 관련 질문 ============
    {
        "input": "Python에서 리스트와 튜플의 차이점을 설명해주세요",
        "expected_output": "리스트는 가변(mutable)이고 []로 표현, 수정/추가/삭제가 가능합니다. 튜플은 불변(immutable)이고 ()로 표현, 한번 생성하면 변경할 수 없어 해시 가능하며 딕셔너리 키로 사용 가능합니다.",
        "category": "programming",
        "difficulty": "easy"
    },
    {
        "input": "객체지향 프로그래밍의 4가지 특징을 설명해줘",
        "expected_output": "1. 캡슐화: 데이터와 메서드를 하나로 묶고 정보 은닉, 2. 상속: 부모 클래스의 속성과 메서드를 자식이 물려받음, 3. 다형성: 같은 메서드가 다른 방식으로 동작, 4. 추상화: 복잡한 시스템을 단순화",
        "category": "programming",
        "difficulty": "medium"
    },
    {
        "input": "재귀함수란 무엇이고 언제 사용하나요?",
        "expected_output": "재귀함수는 자기 자신을 호출하는 함수입니다. 트리 순회, 분할 정복 알고리즘, 피보나치 수열 등 문제를 작은 하위 문제로 나눌 수 있을 때 사용합니다. 반드시 종료 조건(base case)이 있어야 합니다.",
        "category": "programming",
        "difficulty": "medium"
    },
    
    # ============ 역사/인문 관련 질문 ============
    {
        "input": "산업혁명이 사회에 미친 영향을 설명해주세요",
        "expected_output": "산업혁명은 수공업에서 기계 생산으로 전환되며 대량 생산이 가능해졌습니다. 도시화 가속, 노동자 계급 형성, 부의 불평등 심화, 환경 오염 등의 변화를 가져왔습니다.",
        "category": "history",
        "difficulty": "medium"
    },
    {
        "input": "한글 창제의 의의와 특징을 알려줘",
        "expected_output": "세종대왕이 1443년 훈민정음을 창제했습니다. 백성이 쉽게 배울 수 있도록 과학적으로 설계되었으며, 발음기관을 본뜬 자음과 천지인을 상징하는 모음으로 구성됩니다.",
        "category": "history",
        "difficulty": "easy"
    },
    
    # ============ 경제/경영 관련 질문 ============
    {
        "input": "수요와 공급의 법칙을 설명해주세요",
        "expected_output": "수요 법칙: 가격이 오르면 수요량 감소, 가격이 내리면 수요량 증가. 공급 법칙: 가격이 오르면 공급량 증가, 가격이 내리면 공급량 감소. 균형가격에서 수요와 공급이 일치합니다.",
        "category": "economics",
        "difficulty": "easy"
    },
    {
        "input": "기회비용이란 무엇인가요?",
        "expected_output": "기회비용은 어떤 선택을 할 때 포기해야 하는 다른 대안 중 가장 가치가 높은 것의 가치입니다. 예: 대학 진학의 기회비용은 같은 기간 취업했다면 벌 수 있었던 수입입니다.",
        "category": "economics",
        "difficulty": "easy"
    },
]


def create_dataset():
    """Opik 데이터셋 생성"""
    try:
        from utils.opik_evaluation import get_dataset_manager
    except ImportError:
        print("❌ opik_evaluation 모듈을 import할 수 없습니다.")
        print("   apps/api 디렉토리에서 실행해주세요.")
        return False
    
    dm = get_dataset_manager()
    
    if not dm.is_available:
        print("❌ Opik이 설정되지 않았습니다.")
        print("   OPIK_API_KEY 환경변수를 설정해주세요.")
        print("\n   예시:")
        print("   set OPIK_API_KEY=your_api_key_here")
        print("   set OPIK_WORKSPACE=your_workspace")
        return False
    
    # 데이터셋 생성
    dataset_name = "iUM_RAG_Evaluation"
    
    print(f"📊 데이터셋 '{dataset_name}' 생성 중...")
    
    dataset = dm.get_or_create_dataset(
        name=dataset_name,
        description="iUM 학습 플랫폼 RAG 시스템 평가를 위한 Q&A 데이터셋"
    )
    
    if dataset is None:
        print("❌ 데이터셋 생성 실패")
        return False
    
    # 아이템 추가
    items = []
    for item in IUM_EVALUATION_DATASET:
        items.append({
            "input": item["input"],
            "expected_output": item["expected_output"],
            "category": item.get("category", "general"),
            "difficulty": item.get("difficulty", "medium"),
        })
    
    success = dm.insert_items(dataset_name, items)
    
    if success:
        print(f"✅ {len(items)}개 아이템이 데이터셋에 추가되었습니다!")
        print(f"\n📈 카테고리별 분포:")
        categories = {}
        for item in items:
            cat = item["category"]
            categories[cat] = categories.get(cat, 0) + 1
        for cat, count in sorted(categories.items()):
            print(f"   - {cat}: {count}개")
        return True
    else:
        print("❌ 아이템 추가 실패")
        return False


def list_datasets():
    """기존 데이터셋 목록 조회"""
    try:
        from utils.opik_evaluation import get_dataset_manager
    except ImportError:
        print("❌ opik_evaluation 모듈을 import할 수 없습니다.")
        return
    
    dm = get_dataset_manager()
    
    if not dm.is_available:
        print("❌ Opik이 설정되지 않았습니다.")
        return
    
    datasets = dm.list_datasets()
    
    if not datasets:
        print("📭 등록된 데이터셋이 없습니다.")
        return
    
    print(f"📊 등록된 데이터셋 ({len(datasets)}개):")
    for ds in datasets:
        print(f"   - {ds['name']}: {ds.get('description', 'No description')}")


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="iUM Opik 평가 데이터셋 관리")
    parser.add_argument("--list", action="store_true", help="데이터셋 목록 조회")
    parser.add_argument("--create", action="store_true", help="평가 데이터셋 생성")
    
    args = parser.parse_args()
    
    if args.list:
        list_datasets()
    elif args.create:
        create_dataset()
    else:
        print("iUM Opik 평가 데이터셋 관리 도구")
        print("\n사용법:")
        print("  --list   : 데이터셋 목록 조회")
        print("  --create : 기본 평가 데이터셋 생성")
        print("\n예시:")
        print("  python scripts/create_evaluation_dataset.py --create")
