# Order Lifecycle

## Normal flow
`placed -> accepted -> preparing -> ready_for_dispatch -> out_for_delivery -> delivered`

## Alternate outcomes
- `placed -> rejected`
- `accepted -> cancelled` only if cancellation policy permits
- `preparing -> cancelled` only if explicitly permitted by policy
- Other transitions require an explicit documented business decision.

## Rules
- Only authorized administrators can accept, reject or advance restaurant-managed statuses.
- Customer cancellation must follow a documented policy and valid transition.
- Each successful transition writes a status-history row in the same transaction as the order update.
- Invalid transitions return a conflict response.
- Store actor, timestamp and reason when applicable.
- Realtime informs clients of changes; clients should retrieve persisted state after reconnecting.
- Payment status is separate from order status.
- Demo payment states must be clearly identified as simulated.
