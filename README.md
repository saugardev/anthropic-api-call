# ZK Email Parts Extraction

This API provides an endpoint for extracting specific information from email content using regex-based patterns. It uses Claude AI to generate optimized extraction patterns based on your goals.

## Prerequisites

- Node.js installed
- npm or yarn package manager
- Anthropic API key

## Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory and add your Anthropic API key:
```
ANTHROPIC_API_KEY=your_api_key_here
```

## API Endpoint

### POST /extract

Extracts specified information from an email file.

#### Request

- Method: `POST`
- Content-Type: `multipart/form-data`
- URL: `http://localhost:3000/extract`

#### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| emlFile | File | Yes | The email file in .eml format |
| extractionGoals | String | Yes | Description of what information to extract |

#### Response Format

The API returns a string containing a json of values regex patterns for extracting the requested information

```json
{
  "result": {
    "values": [
      {
        "name": "email_sender",
        "parts": [
          {
            "is_public": false,
            "regex_def": "..."
          },
          {
            "is_public": true,
            "regex_def": "..."
          }
        ],
        "location": "from",
        "maxLength": 64
      },
      // Additional extraction patterns...
    ]
  }
}
```

## Running the Server

Start the server:
```bash
node server.js
```

The server will run on port 3000 by default. You can modify the port by setting the `PORT` environment variable.

## Notes

- The API uses Claude 3.5 Sonnet for generating extraction patterns
- Maximum response tokens is set to 1000
- Temperature is set to 0 for consistent results

## Limitations

- Email file must be in valid .eml format
- Large email files may take longer to process
- Complex extraction patterns may require more specific extraction goal descriptions
- Without clear context, the LLM may struggle to accurately extract text from the provided email