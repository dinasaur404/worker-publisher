import Cloudflare from "cloudflare";

// Deploy function (copied from deploy-wfp.ts)
async function deploySnippetToNamespace(opts: {
  namespaceName: string;
  scriptName: string;
  code: string;
  bindings?: Array<
    | { type: "plain_text"; name: string; text: string }
    | { type: "kv_namespace"; name: string; namespace_id: string }
    | { type: "r2_bucket"; name: string; bucket_name: string }
  >;
}, env: {
  CLOUDFLARE_API_TOKEN: string;
  CLOUDFLARE_ACCOUNT_ID: string;
}) {
  const { namespaceName, scriptName, code, bindings = [] } = opts;
  
  const cf = new Cloudflare({ 
    apiToken: env.CLOUDFLARE_API_TOKEN 
  });
  
  // Ensure dispatch namespace exists
  try {
    await cf.workersForPlatforms.dispatch.namespaces.get(namespaceName, {
      account_id: env.CLOUDFLARE_ACCOUNT_ID,
    });
  } catch {
    await cf.workersForPlatforms.dispatch.namespaces.create({
      account_id: env.CLOUDFLARE_ACCOUNT_ID,
      name: namespaceName,
    });
  }

  const moduleFileName = `${scriptName}.mjs`;
  
  // Upload worker to namespace
  await cf.workersForPlatforms.dispatch.namespaces.scripts.update(
    namespaceName,
    scriptName,
    {
      account_id: env.CLOUDFLARE_ACCOUNT_ID,
      metadata: {
        main_module: moduleFileName,
        bindings,
      },
      files: {
        [moduleFileName]: new File([code], moduleFileName, {
          type: "application/javascript+module"
        }),
      },
    }
  );

  return { namespace: namespaceName, script: scriptName };
}

const HTML_UI = `<!DOCTYPE html>
<html>
<head>
  <title>Worker Publisher</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    textarea { width: 100%; height: 300px; font-family: monospace; }
    input, button { padding: 8px; margin: 5px 0; }
    button { background: #f38020; color: white; border: none; padding: 10px 20px; cursor: pointer; }
    .result { background: #f0f0f0; padding: 10px; margin: 10px 0; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>Worker Publisher</h1>
  <form id="deployForm">
    <div>
      <label>Script Name:</label><br>
      <input type="text" id="scriptName" placeholder="my-worker" required>
    </div>
    <div>
      <label>Worker Code:</label><br>
      <textarea id="code" placeholder="export default {
  async fetch(request, env) {
    return new Response('Hello World!');
  }
};" required></textarea>
    </div>
    <button type="submit">Deploy Worker</button>
  </form>
  <div id="result"></div>

  <script>
    document.getElementById('deployForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const scriptName = document.getElementById('scriptName').value;
      const code = document.getElementById('code').value;
      const resultDiv = document.getElementById('result');
      
      resultDiv.innerHTML = 'Deploying...';
      
      try {
        const response = await fetch('/deploy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scriptName, code })
        });
        
        const result = await response.json();
        
        if (response.ok) {
          resultDiv.innerHTML = \`<div class="result">✅ Successfully deployed worker "\${result.script}" to namespace "\${result.namespace}"<br>Access it at: <a href="/\${result.script}">/\${result.script}</a></div>\`;
        } else {
          resultDiv.innerHTML = \`<div class="result">❌ Error: \${result.error}</div>\`;
        }
      } catch (error) {
        resultDiv.innerHTML = \`<div class="result">❌ Error: \${error.message}</div>\`;
      }
    });
  </script>
</body>
</html>`;

export default {
  async fetch(request: Request, env: {
    CLOUDFLARE_API_TOKEN: string;
    CLOUDFLARE_ACCOUNT_ID: string;
    DISPATCHER: any;
  }) {
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/').filter(Boolean);
    
    // Handle UI route
    if (pathSegments.length === 0) {
      return new Response(HTML_UI, {
        headers: { 'Content-Type': 'text/html' }
      });
    }
    
    // Handle deploy endpoint
    if (pathSegments[0] === 'deploy' && request.method === 'POST') {
      try {
        const { scriptName, code } = await request.json();
        
        if (!scriptName || !code) {
          return new Response(JSON.stringify({ error: 'Missing scriptName or code' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        const result = await deploySnippetToNamespace({
          namespaceName: 'my-dispatch-namespace',
          scriptName,
          code
        }, env);
        
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Handle worker dispatch (existing functionality)
    const workerName = pathSegments[0];
    
    try {
      const worker = env.DISPATCHER.get(workerName);
      return await worker.fetch(request);
    } catch (e) {
      if (e.message.startsWith('Worker not found')) {
        return new Response(`Worker '${workerName}' not found`, { status: 404 });
      }
      return new Response('Internal error', { status: 500 });
    }
  }
};