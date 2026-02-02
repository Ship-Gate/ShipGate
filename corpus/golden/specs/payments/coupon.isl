// Payments: Coupon and discount management
domain PaymentsCoupon {
  version: "1.0.0"

  type Money = Decimal { min: 0, precision: 2 }

  enum DiscountType {
    PERCENTAGE
    FIXED_AMOUNT
  }

  enum CouponDuration {
    ONCE
    REPEATING
    FOREVER
  }

  entity Coupon {
    id: UUID [immutable, unique]
    code: String [unique, indexed]
    name: String
    discount_type: DiscountType
    discount_amount: Decimal?
    discount_percent: Decimal?
    currency: String?
    duration: CouponDuration
    duration_months: Int?
    max_redemptions: Int?
    redemption_count: Int [default: 0]
    applies_to_products: List<UUID>?
    minimum_amount: Decimal?
    valid_from: Timestamp?
    valid_until: Timestamp?
    active: Boolean [default: true]
    created_at: Timestamp [immutable]

    invariants {
      discount_type == PERCENTAGE implies discount_percent != null
      discount_type == FIXED_AMOUNT implies discount_amount != null
      discount_percent == null or (discount_percent > 0 and discount_percent <= 100)
      discount_amount == null or discount_amount > 0
      duration == REPEATING implies duration_months != null
      max_redemptions == null or max_redemptions > 0
      redemption_count >= 0
    }
  }

  entity Redemption {
    id: UUID [immutable, unique]
    coupon_id: UUID [indexed]
    customer_id: UUID [indexed]
    subscription_id: UUID?
    invoice_id: UUID?
    discount_applied: Decimal
    created_at: Timestamp [immutable]
  }

  behavior CreateCoupon {
    description: "Create a coupon"

    actors {
      Merchant { must: authenticated }
    }

    input {
      code: String
      name: String
      discount_type: DiscountType
      discount_amount: Decimal?
      discount_percent: Decimal?
      currency: String?
      duration: CouponDuration
      duration_months: Int?
      max_redemptions: Int?
      applies_to_products: List<UUID>?
      minimum_amount: Decimal?
      valid_from: Timestamp?
      valid_until: Timestamp?
    }

    output {
      success: Coupon

      errors {
        CODE_EXISTS {
          when: "Coupon code already exists"
          retriable: false
        }
        INVALID_DISCOUNT {
          when: "Invalid discount configuration"
          retriable: true
        }
        INVALID_DURATION {
          when: "Invalid duration configuration"
          retriable: true
        }
      }
    }

    pre {
      input.code.length > 0
      not Coupon.exists(code: input.code)
      input.discount_type == PERCENTAGE implies (input.discount_percent != null and input.discount_percent > 0 and input.discount_percent <= 100)
      input.discount_type == FIXED_AMOUNT implies (input.discount_amount != null and input.discount_amount > 0)
    }

    post success {
      - Coupon.exists(result.id)
      - result.code == input.code
      - result.active == true
      - result.redemption_count == 0
    }
  }

  behavior ValidateCoupon {
    description: "Validate a coupon code"

    actors {
      System { }
      Customer { must: authenticated }
    }

    input {
      code: String
      customer_id: UUID?
      amount: Decimal?
      product_ids: List<UUID>?
    }

    output {
      success: {
        coupon: Coupon
        discount: Decimal
        valid: Boolean
      }

      errors {
        COUPON_NOT_FOUND {
          when: "Coupon not found"
          retriable: false
        }
        COUPON_EXPIRED {
          when: "Coupon has expired"
          retriable: false
        }
        COUPON_INACTIVE {
          when: "Coupon is inactive"
          retriable: false
        }
        MAX_REDEMPTIONS_REACHED {
          when: "Maximum redemptions reached"
          retriable: false
        }
        MINIMUM_NOT_MET {
          when: "Minimum purchase not met"
          retriable: true
        }
        PRODUCT_NOT_APPLICABLE {
          when: "Coupon not applicable to products"
          retriable: false
        }
      }
    }

    pre {
      input.code.length > 0
    }

    post success {
      - result.valid == true
      - result.discount > 0
    }
  }

  behavior RedeemCoupon {
    description: "Apply coupon to purchase"

    actors {
      System { }
    }

    input {
      coupon_id: UUID
      customer_id: UUID
      invoice_id: UUID?
      subscription_id: UUID?
      amount: Decimal
    }

    output {
      success: Redemption

      errors {
        COUPON_NOT_FOUND {
          when: "Coupon not found"
          retriable: false
        }
        COUPON_INVALID {
          when: "Coupon is not valid"
          retriable: false
        }
        ALREADY_REDEEMED {
          when: "Customer already redeemed this coupon"
          retriable: false
        }
      }
    }

    pre {
      Coupon.exists(input.coupon_id)
      Coupon.lookup(input.coupon_id).active == true
    }

    post success {
      - Redemption.exists(result.id)
      - Coupon.lookup(input.coupon_id).redemption_count == old(Coupon.lookup(input.coupon_id).redemption_count) + 1
    }
  }

  behavior DeactivateCoupon {
    description: "Deactivate a coupon"

    actors {
      Merchant { must: authenticated }
    }

    input {
      coupon_id: UUID
    }

    output {
      success: Coupon

      errors {
        NOT_FOUND {
          when: "Coupon not found"
          retriable: false
        }
        ALREADY_INACTIVE {
          when: "Coupon already inactive"
          retriable: false
        }
      }
    }

    pre {
      Coupon.exists(input.coupon_id)
    }

    post success {
      - result.active == false
    }
  }

  behavior ListCoupons {
    description: "List coupons"

    actors {
      Merchant { must: authenticated }
    }

    input {
      active_only: Boolean?
      page: Int?
      page_size: Int?
    }

    output {
      success: {
        coupons: List<Coupon>
        total_count: Int
        has_more: Boolean
      }
    }
  }

  scenarios CreateCoupon {
    scenario "percentage discount" {
      when {
        result = CreateCoupon(
          code: "SAVE20",
          name: "20% Off",
          discount_type: PERCENTAGE,
          discount_percent: 20,
          duration: ONCE
        )
      }

      then {
        result is success
        result.discount_percent == 20
      }
    }

    scenario "fixed amount discount" {
      when {
        result = CreateCoupon(
          code: "10OFF",
          name: "$10 Off",
          discount_type: FIXED_AMOUNT,
          discount_amount: 10.00,
          currency: "USD",
          duration: ONCE
        )
      }

      then {
        result is success
        result.discount_amount == 10.00
      }
    }
  }
}
