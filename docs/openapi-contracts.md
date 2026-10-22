# Contratos de Entrada e Saída - Projeto Typescript

Este documento detalha os contratos para os novos endpoints utilizando **Chain of Responsibility** e **State Pattern**.

---

## 1. Chain of Responsibility Pattern (Processamento de Requisições / Pipeline)

### Endpoint: `POST /api/pipeline/process`

#### Contrato de Entrada (`Request Body`)
```json
{
  "requestId": "string (UUID)",
  "payload": {
    "data": "any",
    "type": "string"
  },
  "metadata": {
    "source": "string",
    "timestamp": "string (ISO-8601)"
  }
}
```

#### Contrato de Saída (`Response Body - Success 200 OK`)
```json
{
  "success": true,
  "requestId": "string (UUID)",
  "processedData": {
    "data": "any",
    "status": "PROCESSED"
  },
  "auditTrail": [
    {
      "handler": "AuthenticationHandler",
      "status": "PASSED",
      "timestamp": "string"
    },
    {
      "handler": "ValidationHandler",
      "status": "PASSED",
      "timestamp": "string"
    },
    {
      "handler": "TransformationHandler",
      "status": "PASSED",
      "timestamp": "string"
    }
  ]
}
```

#### Contrato de Saída (`Response Body - Error 400/422`)
```json
{
  "success": false,
  "requestId": "string (UUID)",
  "error": {
    "code": "HANDLER_VALIDATION_FAILED",
    "message": "Detailed error message",
    "failedHandler": "ValidationHandler"
  }
}
```

---

## 2. State Pattern (Gerenciamento de Ciclo de Vida / Estados)

### Endpoint: `GET /api/document/{id}/state`
#### Contrato de Saída (`Response Body - 200 OK`)
```json
{
  "id": "string",
  "currentState": "DRAFT | REVIEW | APPROVED | PUBLISHED | ARCHIVED",
  "allowedTransitions": ["REVIEW", "ARCHIVED"],
  "updatedAt": "string (ISO-8601)"
}
```

### Endpoint: `POST /api/document/{id}/transition`

#### Contrato de Entrada (`Request Body`)
```json
{
  "targetState": "REVIEW | APPROVED | PUBLISHED | ARCHIVED",
  "reason": "string (optional)"
}
```

#### Contrato de Saída (`Response Body - Success 200 OK`)
```json
{
  "id": "string",
  "previousState": "DRAFT",
  "currentState": "REVIEW",
  "message": "State transitioned successfully",
  "timestamp": "string (ISO-8601)"
}
```

#### Contrato de Saída (`Response Body - Error 400 Bad Request`)
```json
{
  "success": false,
  "error": {
    "code": "INVALID_STATE_TRANSITION",
    "message": "Transition from DRAFT to PUBLISHED is not allowed."
  }
}
```
