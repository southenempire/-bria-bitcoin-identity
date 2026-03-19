// Auto-generated — Clarity contract source for in-browser deployment
export const CLARITY_CONTRACT = `;; BRIA Registry: Bitcoin Real-time Identity Agent Registry
;; This contract allows AI agents to register their identity on the Stacks blockchain.

(define-constant ERR-NOT-AUTHORIZED (err u100))
(define-constant ERR-ALREADY-REGISTERED (err u101))
(define-constant ERR-AGENT-NOT-FOUND (err u102))

;; Data Map: Agent ID (Principal) -> Agent Profile
(define-map agents
  principal
  {
    name: (string-ascii 64),
    description: (string-ascii 256),
    image-url: (string-ascii 256),
    public-key: (buff 33),
    vouched: bool,
    created-at: uint
  }
)

;; Discovery: ID -> Principal mapping
(define-map agent-ids uint principal)
(define-data-var agent-count uint u0)

;; Read-only: Get agent profile
(define-read-only (get-agent (agent principal))
  (map-get? agents agent)
)

;; Read-only: Get agent by ID
(define-read-only (get-agent-by-id (id uint))
  (match (map-get? agent-ids id)
    agent (map-get? agents agent)
    none
  )
)

;; Read-only: Get total agents
(define-read-only (get-total-agents)
  (var-get agent-count)
)

;; Public: Register a new agent
(define-public (register-agent (name (string-ascii 64)) (description (string-ascii 256)) (image-url (string-ascii 256)) (public-key (buff 33)))
  (let
    (
      (agent tx-sender)
      (new-id (+ (var-get agent-count) u1))
    )
    (asserts! (is-none (get-agent agent)) ERR-ALREADY-REGISTERED)
    (map-set agents agent
      {
        name: name,
        description: description,
        image-url: image-url,
        public-key: public-key,
        vouched: false,
        created-at: block-height
      }
    )
    (map-set agent-ids new-id agent)
    (var-set agent-count new-id)
    (ok new-id)
  )
)

;; Public: Update agent profile
(define-public (update-agent (name (string-ascii 64)) (description (string-ascii 256)) (image-url (string-ascii 256)) (public-key (buff 33)))
  (let
    (
      (agent tx-sender)
    )
    (asserts! (is-some (get-agent agent)) ERR-AGENT-NOT-FOUND)
    (ok (map-set agents agent
      {
        name: name,
        description: description,
        image-url: image-url,
        public-key: public-key,
        vouched: false,
        created-at: block-height
      }
    ))
  )
)

;; Public: Vouch for an agent
(define-public (vouch-agent (agent principal))
  (let
    (
      (current-agent (unwrap! (get-agent agent) ERR-AGENT-NOT-FOUND))
    )
    (ok (map-set agents agent (merge current-agent { vouched: true })))
  )
)`;
