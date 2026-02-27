domain CommentEvidence {
  version: "1.0.0"

  behavior getEnvConfig {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - getEnvConfig never_throws_unhandled
    }
  }
  behavior githubRequest {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - githubRequest never_throws_unhandled
    }
  }
  behavior listPRComments {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - listPRComments never_throws_unhandled
    }
  }
  behavior createComment {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - createComment never_throws_unhandled
    }
  }
  behavior updateComment {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - updateComment never_throws_unhandled
    }
  }
  behavior findExistingComment {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - findExistingComment never_throws_unhandled
    }
  }
  behavior loadEvidenceReport {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - loadEvidenceReport never_throws_unhandled
    }
  }
  behavior getRecommendationEmoji {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - getRecommendationEmoji never_throws_unhandled
    }
  }
  behavior getVerdictLabel {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - getVerdictLabel never_throws_unhandled
    }
  }
  behavior formatLocation {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - formatLocation never_throws_unhandled
    }
  }
  behavior generateCommentBody {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - generateCommentBody never_throws_unhandled
    }
  }
  behavior postEvidenceComment {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - postEvidenceComment never_throws_unhandled
    }
  }
  behavior main {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - main never_throws_unhandled
    }
  }
}
