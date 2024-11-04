import express from 'express';
import multer from 'multer';
import Anthropic from "@anthropic-ai/sdk";
import dotenv from 'dotenv';

dotenv.config();
const app = express();
const upload = multer();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const PROMPT = `You are tasked with creating zkemail parts that will be used to extract specific information from canonicalized email content. Each extraction goal will be represented as a value object containing an array of regex parts that match continuous sections of the email content.

Here is the non canonicalized email content you will be working with:
<email_content>
{{EMAIL_CONTENT}}
</email_content>

The extraction goals for this email are:
<extraction_goals>
{{EXTRACTION_GOALS}}
</extraction_goals>

Your task is to create a JSON structure that defines how to extract this information. The output should be in this format:

\`\`\`json
{
  "values": [
    {
      "name": "descriptive_field_name",
      "parts": [
        {
          "is_public": boolean,
          "regex_def": "regex_pattern"
        },
        ...
      ],
      "location": "body|subject|from|to",
      "maxLength": number
    }
  ]
}
\`\`\`

Key Requirements:

1. Value Object Structure:
- "name": A descriptive name for the extracted field
- "parts": Array of regex parts that together match the complete field
- "location": Where to look for this field (body, subject, from, to)
- "maxLength": Maximum expected length of the extracted content

2. Parts Array Requirements:
- Each part must be continuous with the next part in the email
- Break the match into public and private sections
- Private parts (is_public: false) typically match static text
- Public parts (is_public: true) capture the desired information

3. Regex Pattern Rules:
- JSON special characters need single backslash escape: \\"
- Regex special characters need double backslash escape: \\\\n, \\\\b
- Use non-greedy matches where appropriate: *?, +?
- Consider word boundaries for accuracy: \\\\b
- Use character classes when needed: [^\\\\n]+
- Characters that don't use backslash scape: <, >, /

4. Rules:
- When asked for email sender, email recipient, email subject or email timestamp, you must use the provide template without modify.

Example:
For extracting a name like "Hi John Smith," you would create:
{
  "values": [
    {
      "name": "recipient_name",
      "parts": [
        {
          "is_public": false,
          "regex_def": "Hi "
        },
        {
          "is_public": true,
          "regex_def": "[^,]+"
        },
        {
          "is_public": false,
          "regex_def": ","
        }
      ],
      "location": "body",
      "maxLength": 64
    }
  ]
}

For extracting a text inside html tags like "<div id=\\"text\\">Hello World!</div" you would create:
{
  "values": [
    {
      "name": "recipient_name",
      "parts": [
        {
          "is_public": false,
          "regex_def": "<div id=\\"text\\">"
        },
        {
          "is_public": true,
          "regex_def": "[^<]+"
        },
        {
          "is_public": false,
          "regex_def": "<"
        }
      ],
      "location": "body",
      "maxLength": 64
    }
  ]
}

For extracting the email sender use exactly:
{
  "values": [
    {
      "name": "email_sender",
      "parts": [
        {
          "is_public": false,
          "regex_def": "(\\r\\n|^)from:"
        },
        {
          "is_public": false,
          "regex_def": "([^\\r\\n]+<)?"
        },
        {
          "is_public": true,
          "regex_def": "[A-Za-z0-9!#$%&'\\\\*\\\\+-/=\\\\?\\\\^_\`{\\\\|}~\\\\.]+@[A-Za-z0-9\\\\.-]+"
        },
        {
          "is_public": false,
          "regex_def": ">?\\r\\n"
        }
      ],
      "location": "from",
      "maxLength": 64
    }
  ]
}

For extracting the email recipient use exactly:
{
  "values": [
    {
      "name": "email_recipient",
      "parts": [
        {
          "is_public": false,
          "regex_def": "(\\r\\n|^)to:"
        },
        {
          "is_public": false,
          "regex_def": "([^\\r\\n]+<)?"
        },
        {
          "is_public": true,
          "regex_def": "[a-zA-Z0-9!#$%&'\\\\*\\\\+-/=\\\\?\\\\^_\`{\\\\|}~\\\\.]+@[a-zA-Z0-9_\\\\.-]+"
        },
        {
          "is_public": false,
          "regex_def": ">?\\r\\n"
        }
      ],
      "location": "to",
      "maxLength": 64
    }
  ]
}

For extracting the email subject use exactly:
{
  "values": [
    {
      "name": "email_subject",
      "parts": [
        {
          "is_public": false,
          "regex_def": "(\\r\\n|^)subject:"
        },
        {
          "is_public": true,
          "regex_def": "[^\\r\\n]+"
        },
        {
          "is_public": false,
          "regex_def": "\\r\\n"
        }
      ],
      "location": "subject",
      "maxLength": 64
    }
  ]
}

For extracting the email timestamp use exactly:
{
  "values": [
    {
      "name": "email_timestamp",
      "parts": [
        {
          "is_public": false,
          "regex_def": "(\\r\\n|^)dkim-signature:"
        },
        {
          "is_public": false,
          "regex_def": "([a-z]+=[^;]+; )+t="
        },
        {
          "is_public": true,
          "regex_def": "[0-9]+"
        },
        {
          "is_public": false,
          "regex_def": ";"
        }
      ],
      "location": "timestamp",
      "maxLength": 64
    }
  ]
}

For each extraction goal, please:
1. Create a value object with appropriate name
2. Break the match into logical public/private parts
3. Specify the correct location
4. Set a reasonable maxLength (16, 32, 64, 128, 192...)
5. Ensure patterns are specific enough to avoid false matches
6. Test that parts are continuous in the email content

The goal is to create patterns that reliably extract the desired information while clearly separating public and private content.`;

app.post('/extract', upload.single('emlFile'), async (req, res) => {
  try {
    if (!req.file || !req.body.extractionGoals) {
      return res.status(400).json({ error: 'Missing email file or extraction goals' });
    }

    const emailContent = req.file.buffer.toString('utf-8');
    const extractionGoals = req.body.extractionGoals;

    const promptWithReplacements = PROMPT
      .replace('{{EMAIL_CONTENT}}', emailContent)
      .replace('{{EXTRACTION_GOALS}}', extractionGoals);

    const msg = await anthropic.messages.create({
      // model: "claude-3-5-sonnet-20240620", // older model
      model: "claude-3-5-sonnet-20241022", // latest
      max_tokens: 1000,
      temperature: 0,
      system: "You must create a array with valid zkemail parts JSON. You must create an object for each part asked",
      messages: [
        {
          role: "user",
          content: promptWithReplacements
        }
      ]
    });

    res.json({ result: msg.content[0].text });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});