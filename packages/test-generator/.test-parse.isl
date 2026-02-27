domain T {
  version: "1.0.0"
  behavior B {
    input { x: Int }
    output { success: Boolean }
  }
  scenario "test" {
    given {
      a = B(x: 1)
    }
    when {
      b = B(x: 2)
    }
    then {
      b.success
    }
  }
}
