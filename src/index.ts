export default {
	async fetch(request, env) {
	  const url = new URL(request.url);
	  const pathSegments = url.pathname.split('/').filter(Boolean);
	  
	  if (pathSegments.length === 0) {
		return new Response('Please specify a Worker name in the path', { status: 400 });
	  }
	  
	  // First path segment is the Worker name
	  const workerName = pathSegments[0];
	  
	  try {
		// Get Worker from dispatch namespace
		const worker = env.DISPATCHER.get(workerName);
		
		// Forward request to the Worker
		return await worker.fetch(request);
	  } catch (e) {
		if (e.message.startsWith('Worker not found')) {
		  return new Response(`Worker '${workerName}' not found`, { status: 404 });
		}
		return new Response('Internal error', { status: 500 });
	  }
	}
  };