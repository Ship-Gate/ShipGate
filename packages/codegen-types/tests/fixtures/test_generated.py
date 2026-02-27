#!/usr/bin/env python3
"""
Test Harness for Generated Python Code

This script tests the generated Python contracts to verify they work correctly.
It demonstrates end-to-end functionality of ISL Python codegen.

Run with: python test_generated.py
"""

import sys
import os
from dataclasses import dataclass
from decimal import Decimal
from typing import Optional
from uuid import UUID, uuid4

# Add parent directory to path for isl_runtime import
_this_dir = os.path.dirname(os.path.abspath(__file__))
_codegen_types_dir = os.path.dirname(os.path.dirname(_this_dir))
_templates_dir = os.path.join(_codegen_types_dir, 'templates', 'python')
sys.path.insert(0, _templates_dir)

from isl_runtime import (
    ContractError,
    PreconditionError,
    PostconditionError,
    InvariantError,
    ContractMode,
    set_contract_mode,
    get_contract_mode,
    InMemoryEntityStore,
    register_entity_store,
    check_precondition,
    check_postcondition,
    preconditions,
    postconditions,
    contract,
    reset_config,
)


# ============================================================================
# Test Data Models (simulating generated code)
# ============================================================================

@dataclass
class Account:
    """Entity: Account"""
    id: UUID
    balance: Decimal
    is_active: bool


@dataclass
class TransferFundsInput:
    """Input for TransferFunds"""
    sender_id: UUID
    receiver_id: UUID
    amount: Decimal


@dataclass
class TransferFundsSuccess:
    """Success result for TransferFunds"""
    success: bool = True
    data: Optional[Account] = None


@dataclass
class TransferFundsError:
    """Error result for TransferFunds"""
    success: bool = False
    code: str = ""
    message: str = ""


# ============================================================================
# Contract-Decorated Implementation
# ============================================================================

@contract(
    pre=[
        lambda inp: inp.amount > 0,
        lambda inp: inp.sender_id != inp.receiver_id,
    ],
    post=[
        lambda inp, res: not res.success or res.data.balance >= 0,
    ]
)
def transfer_funds(input: TransferFundsInput) -> TransferFundsSuccess:
    """
    Transfer funds between accounts.
    
    This implementation demonstrates the contract decorator pattern.
    """
    # Simulated implementation
    new_balance = Decimal("100.00") - input.amount
    result_account = Account(
        id=input.sender_id,
        balance=new_balance,
        is_active=True,
    )
    return TransferFundsSuccess(success=True, data=result_account)


# ============================================================================
# Tests
# ============================================================================

def test_precondition_pass():
    """Test that valid input passes preconditions."""
    reset_config()
    set_contract_mode(ContractMode.STRICT)
    
    input = TransferFundsInput(
        sender_id=uuid4(),
        receiver_id=uuid4(),
        amount=Decimal("50.00"),
    )
    
    result = transfer_funds(input)
    assert result.success is True
    assert result.data is not None
    print("[PASS] test_precondition_pass")


def test_precondition_fail_negative_amount():
    """Test that negative amount fails precondition."""
    reset_config()
    set_contract_mode(ContractMode.STRICT)
    
    input = TransferFundsInput(
        sender_id=uuid4(),
        receiver_id=uuid4(),
        amount=Decimal("-10.00"),
    )
    
    try:
        transfer_funds(input)
        assert False, "Should have raised PreconditionError"
    except PreconditionError as e:
        assert "Precondition" in str(e)
        print("[PASS] test_precondition_fail_negative_amount")


def test_precondition_fail_same_account():
    """Test that same sender/receiver fails precondition."""
    reset_config()
    set_contract_mode(ContractMode.STRICT)
    
    same_id = uuid4()
    input = TransferFundsInput(
        sender_id=same_id,
        receiver_id=same_id,
        amount=Decimal("50.00"),
    )
    
    try:
        transfer_funds(input)
        assert False, "Should have raised PreconditionError"
    except PreconditionError as e:
        assert "Precondition" in str(e)
        print("[PASS] test_precondition_fail_same_account")


def test_contract_mode_warn():
    """Test that warn mode logs but doesn't raise."""
    reset_config()
    set_contract_mode(ContractMode.WARN)
    
    input = TransferFundsInput(
        sender_id=uuid4(),
        receiver_id=uuid4(),
        amount=Decimal("-10.00"),
    )
    
    # Should not raise, just warn
    import warnings
    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter("always")
        result = transfer_funds(input)
        # Check that a warning was issued
        assert len(w) > 0
        print("[PASS] test_contract_mode_warn")


def test_contract_mode_skip():
    """Test that skip mode bypasses all checks."""
    reset_config()
    set_contract_mode(ContractMode.SKIP)
    
    input = TransferFundsInput(
        sender_id=uuid4(),
        receiver_id=uuid4(),
        amount=Decimal("-10.00"),
    )
    
    # Should not raise or warn
    result = transfer_funds(input)
    assert result is not None
    print("[PASS] test_contract_mode_skip")


def test_entity_store():
    """Test entity store functionality."""
    reset_config()
    
    store = InMemoryEntityStore[Account]()
    
    acc1 = Account(id=uuid4(), balance=Decimal("100.00"), is_active=True)
    acc2 = Account(id=uuid4(), balance=Decimal("200.00"), is_active=False)
    
    store.add(acc1)
    store.add(acc2)
    
    assert store.count() == 2
    assert store.exists({"is_active": True})
    assert store.lookup({"id": acc1.id}) == acc1
    assert store.count({"is_active": False}) == 1
    
    print("[PASS] test_entity_store")


def test_check_helpers():
    """Test check_precondition and check_postcondition helpers."""
    reset_config()
    set_contract_mode(ContractMode.STRICT)
    
    # Should pass
    check_precondition(True, "This should pass")
    
    # Should fail
    try:
        check_precondition(False, "This should fail")
        assert False, "Should have raised"
    except PreconditionError:
        pass
    
    # Should pass
    check_postcondition(True, "This should pass")
    
    # Should fail
    try:
        check_postcondition(False, "This should fail")
        assert False, "Should have raised"
    except PostconditionError:
        pass
    
    print("[PASS] test_check_helpers")


def run_all_tests():
    """Run all tests."""
    print("\n" + "=" * 60)
    print("ISL Python Codegen Test Harness")
    print("=" * 60 + "\n")
    
    tests = [
        test_precondition_pass,
        test_precondition_fail_negative_amount,
        test_precondition_fail_same_account,
        test_contract_mode_warn,
        test_contract_mode_skip,
        test_entity_store,
        test_check_helpers,
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            test()
            passed += 1
        except Exception as e:
            print(f"[FAIL] {test.__name__}: {e}")
            failed += 1
    
    print("\n" + "-" * 60)
    print(f"Results: {passed} passed, {failed} failed")
    print("-" * 60)
    
    return failed == 0


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
