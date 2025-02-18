```
pnpm install
pnpm run dev
```

## GET Model Inference Providers

Retrieves information about the inference providers available for a specific model on Hugging Face.

**Endpoint:**

```
GET https://huggingface.co/api/models/{model}?expand[]=inferenceProviderMapping
```

**Description:**

This endpoint allows you to fetch details about the inference providers that support a given model. This information can be crucial for determining where and how a model can be deployed for inference.

**Example Request:**

```
GET https://huggingface.co/api/models/deepseek-ai/DeepSeek-R1?expand[]=inferenceProviderMapping
```

**Path Parameters:**

- `model` (string, required): The unique identifier for the model. This is typically in the format `namespace/model_name`.

**Query Parameters:**

- `expand[]` (string, optional): An array of fields to expand in the response. To retrieve inference provider mappings, include `inferenceProviderMapping`.

**Response Example:**

```json
{
  "_id": "678dc6fff905d106be796d8a",
  "id": "deepseek-ai/DeepSeek-R1",
  "inferenceProviderMapping": {
    "fireworks-ai": {
      "status": "live",
      "providerId": "accounts/fireworks/models/deepseek-r1",
      "task": "conversational"
    },
    "together": {
      "status": "live",
      "providerId": "deepseek-ai/DeepSeek-R1",
      "task": "conversational"
    },
    "novita": {
      "status": "staging",
      "providerId": "deepseek/deepseek-r1",
      "task": "conversational"
    },
    "nebius": {
      "status": "staging",
      "providerId": "deepseek-ai/DeepSeek-R1-fast",
      "task": "conversational"
    },
    "hyperbolic": {
      "status": "live",
      "providerId": "deepseek-ai/DeepSeek-R1",
      "task": "conversational"
    }
  }
}
```
