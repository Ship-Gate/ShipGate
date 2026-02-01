// Edge case: Unicode content

domain Unicode {
  version: "1.0.0"
  owner: "国际化团队"
  
  // Unicode in type names (if allowed)
  type Описание = String {
    max_length: 1000
  }
  
  entity Пользователь {
    id: UUID [immutable, unique]
    имя: String
    email: String
    状态: String
  }
  
  behavior Créer用户 {
    description: "创建新用户 - Create new user - Créer un utilisateur - 新しいユーザーを作成"
    
    input {
      имя: String
      email: String
    }
    
    output {
      success: Пользователь
      
      errors {
        ОШИБКА_EMAIL {
          when: "邮箱格式不正确 - Invalid email format"
        }
        ПОЛЬЗОВАТЕЛЬ_СУЩЕСТВУЕТ {
          when: "Пользователь уже существует"
        }
      }
    }
    
    postconditions {
      success implies {
        result.имя == input.имя
      }
    }
  }
  
  // Unicode string literals
  entity Content {
    id: UUID
    title: String
    body: String
    
    invariants {
      title.length > 0
    }
  }
  
  scenarios Créer用户 {
    scenario "création réussie 成功创建" {
      when {
        result = Créer用户(
          имя: "测试用户 🎉",
          email: "test@例え.jp"
        )
      }
      
      then {
        result is success
      }
    }
  }
}
