const express = require('express');
const crypto = require('crypto');
const { Octokit } = require('@octokit/rest');

const app = express();
app.use(express.json());

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const GITHUB_APP_ID = process.env.GITHUB_APP_ID;
const GITHUB_PRIVATE_KEY = process.env.GITHUB_PRIVATE_KEY;

function verifySignature(payload, signature) {
  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  const digest = Buffer.from('sha256=' + hmac.update(payload).digest('hex'), 'utf8');
  const checksum = Buffer.from(signature, 'utf8');
  
  if (checksum.length !== digest.length || !crypto.timingSafeEqual(digest, checksum)) {
    return false;
  }
  return true;
}

async function analyzeCode(octokit, owner, repo, sha) {
  try {
    const { data: files } = await octokit.repos.getCommit({
      owner,
      repo,
      ref: sha
    });

    const issues = [];
    
    for (const file of files.files) {
      if (file.filename.endsWith('.js') || file.filename.endsWith('.ts')) {
        const { data: content } = await octokit.repos.getContent({
          owner,
          repo,
          path: file.filename,
          ref: sha
        });
        
        const code = Buffer.from(content.content, 'base64').toString();
        const codeIssues = performCodeAnalysis(code, file.filename);
        issues.push(...codeIssues);
      }
    }

    return issues;
  } catch (error) {
    console.error('Error analyzing code:', error);
    return [];
  }
}

function performCodeAnalysis(code, filename) {
  const issues = [];
  const lines = code.split('\n');
  
  lines.forEach((line, index) => {
    if (line.includes('console.log')) {
      issues.push({
        file: filename,
        line: index + 1,
        message: 'Consider removing console.log statement',
        severity: 'warning'
      });
    }
    
    if (line.includes('eval(')) {
      issues.push({
        file: filename,
        line: index + 1,
        message: 'Use of eval() is dangerous and should be avoided',
        severity: 'error'
      });
    }
    
    if (line.length > 120) {
      issues.push({
        file: filename,
        line: index + 1,
        message: 'Line too long (over 120 characters)',
        severity: 'info'
      });
    }
  });
  
  return issues;
}

async function createCheckRun(octokit, owner, repo, sha, issues) {
  const checkRun = await octokit.checks.create({
    owner,
    repo,
    name: 'Code Analysis',
    head_sha: sha,
    status: 'completed',
    conclusion: issues.some(i => i.severity === 'error') ? 'failure' : 'success',
    output: {
      title: 'Code Analysis Results',
      summary: `Found ${issues.length} issues`,
      annotations: issues.map(issue => ({
        path: issue.file,
        start_line: issue.line,
        end_line: issue.line,
        annotation_level: issue.severity === 'error' ? 'failure' : 'warning',
        message: issue.message
      }))
    }
  });
  
  return checkRun;
}

app.post('/webhook', async (req, res) => {
  const signature = req.headers['x-hub-signature-256'];
  const payload = JSON.stringify(req.body);
  
  if (!verifySignature(payload, signature)) {
    return res.status(401).send('Unauthorized');
  }
  
  const event = req.headers['x-github-event'];
  const body = req.body;
  
  try {
    const octokit = new Octokit({
      auth: `token ${process.env.GITHUB_TOKEN}`
    });
    
    if (event === 'pull_request' && body.action === 'opened') {
      const { owner, repo } = body.repository;
      const sha = body.pull_request.head.sha;
      
      const issues = await analyzeCode(octokit, owner.login, repo.name, sha);
      await createCheckRun(octokit, owner.login, repo.name, sha, issues);
    }
    
    if (event === 'push') {
      const { owner, repo } = body.repository;
      const sha = body.head_commit.id;
      
      const issues = await analyzeCode(octokit, owner.login, repo.name, sha);
      await createCheckRun(octokit, owner.login, repo.name, sha, issues);
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Internal Server Error');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Webhook server running on port ${PORT}`);
});