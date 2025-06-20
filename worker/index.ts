import { d1DatabaseService } from '../src/services/database-d1';

export default {
	async fetch(request: Request, env: any, ctx: any) {
		const url = new URL(request.url);
		const path = url.pathname;

		// CORS headers
		const corsHeaders = {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization',
		};

		// Handle CORS preflight
		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

		try {
			// API routes
			if (path.startsWith('/api/')) {
				return await handleApiRequest(request, env, path, corsHeaders);
			}

			// Serve static assets (for SPA)
			return await handleStaticRequest(request, env);
		} catch (error) {
			console.error('Worker error:', error);
			return new Response(
				JSON.stringify({ error: 'Internal server error' }),
				{
					status: 500,
					headers: { ...corsHeaders, 'Content-Type': 'application/json' }
				}
			);
		}
	},
};

// JWT validation helper (placeholder - implement proper JWT validation)
async function validateJWTAndTenant(request: Request, tenantId: string): Promise<{ valid: boolean; userId?: string; error?: string }> {
	try {
		const authHeader = request.headers.get('Authorization');
		if (!authHeader || !authHeader.startsWith('Bearer ')) {
			return { valid: false, error: 'Missing or invalid Authorization header' };
		}

		const token = authHeader.substring(7);
		
		// TODO: Implement proper JWT validation
		// For now, just check if token exists and return mock validation
		if (!token || token.length < 10) {
			return { valid: false, error: 'Invalid token' };
		}

		// Mock validation - replace with actual JWT validation
		// This should decode the JWT and verify:
		// 1. Token is valid and not expired
		// 2. Token's tenantId matches the requested tenantId
		// 3. User has permission to access this tenant
		
		return { valid: true, userId: 'mock-user-id' };
	} catch (error) {
		return { valid: false, error: 'Token validation failed' };
	}
}

async function handleApiRequest(request: Request, env: any, path: string, corsHeaders: any) {
	const url = new URL(request.url);
	const method = request.method;

	// --- Orders management routes ---
	if (path.startsWith('/api/tenants/') && path.includes('/orders')) {
		const pathParts = path.split('/');
		const tenantId = pathParts[3];
		
		// Validate JWT and tenant access
		const authResult = await validateJWTAndTenant(request, tenantId);
		if (!authResult.valid) {
			return new Response(JSON.stringify({ error: authResult.error || 'Unauthorized' }), {
				status: 401,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}

		// GET /api/tenants/:tenantId/orders - List orders
		if (pathParts.length === 5 && method === 'GET') {
			try {
				const { searchParams } = url;
				const filters = {
					status: searchParams.get('status'),
					assignedTo: searchParams.get('assignedTo'),
					deliveryDate: searchParams.get('deliveryDate'),
					storeId: searchParams.get('storeId')
				};

				// TODO: Implement getOrders in d1DatabaseService
				const orders = await d1DatabaseService.getOrders(env, tenantId, filters);
				return new Response(JSON.stringify(orders), {
					headers: { ...corsHeaders, 'Content-Type': 'application/json' }
				});
			} catch (error) {
				return new Response(JSON.stringify({ error: 'Failed to fetch orders' }), {
					status: 500,
					headers: { ...corsHeaders, 'Content-Type': 'application/json' }
				});
			}
		}

		// POST /api/tenants/:tenantId/orders - Create order
		if (pathParts.length === 5 && method === 'POST') {
			try {
				const orderData = await request.json();
				// TODO: Implement createOrder in d1DatabaseService
				const order = await d1DatabaseService.createOrder(env, tenantId, orderData);
				return new Response(JSON.stringify(order), {
					status: 201,
					headers: { ...corsHeaders, 'Content-Type': 'application/json' }
				});
			} catch (error) {
				return new Response(JSON.stringify({ error: 'Failed to create order' }), {
					status: 500,
					headers: { ...corsHeaders, 'Content-Type': 'application/json' }
				});
			}
		}

		// GET /api/tenants/:tenantId/orders/:orderId - Get single order
		if (pathParts.length === 6 && method === 'GET') {
			try {
				const orderId = pathParts[5];
				// TODO: Implement getOrder in d1DatabaseService
				const order = await d1DatabaseService.getOrder(env, tenantId, orderId);
				if (!order) {
					return new Response(JSON.stringify({ error: 'Order not found' }), {
						status: 404,
						headers: { ...corsHeaders, 'Content-Type': 'application/json' }
					});
				}
				return new Response(JSON.stringify(order), {
					headers: { ...corsHeaders, 'Content-Type': 'application/json' }
				});
			} catch (error) {
				return new Response(JSON.stringify({ error: 'Failed to fetch order' }), {
					status: 500,
					headers: { ...corsHeaders, 'Content-Type': 'application/json' }
				});
			}
		}

		// PUT /api/tenants/:tenantId/orders/:orderId - Update order
		if (pathParts.length === 6 && method === 'PUT') {
			try {
				const orderId = pathParts[5];
				const updateData = await request.json();
				// TODO: Implement updateOrder in d1DatabaseService
				const order = await d1DatabaseService.updateOrder(env, tenantId, orderId, updateData);
				if (!order) {
					return new Response(JSON.stringify({ error: 'Order not found' }), {
						status: 404,
						headers: { ...corsHeaders, 'Content-Type': 'application/json' }
					});
				}
				return new Response(JSON.stringify(order), {
					headers: { ...corsHeaders, 'Content-Type': 'application/json' }
				});
			} catch (error) {
				return new Response(JSON.stringify({ error: 'Failed to update order' }), {
					status: 500,
					headers: { ...corsHeaders, 'Content-Type': 'application/json' }
				});
			}
		}

		// DELETE /api/tenants/:tenantId/orders/:orderId - Delete order
		if (pathParts.length === 6 && method === 'DELETE') {
			try {
				const orderId = pathParts[5];
				// TODO: Implement deleteOrder in d1DatabaseService
				const success = await d1DatabaseService.deleteOrder(env, tenantId, orderId);
				if (!success) {
					return new Response(JSON.stringify({ error: 'Order not found' }), {
						status: 404,
						headers: { ...corsHeaders, 'Content-Type': 'application/json' }
					});
				}
				return new Response(null, { status: 204, headers: corsHeaders });
			} catch (error) {
				return new Response(JSON.stringify({ error: 'Failed to delete order' }), {
					status: 500,
					headers: { ...corsHeaders, 'Content-Type': 'application/json' }
				});
			}
		}
	}

	// --- User management routes (check before single-tenant route) ---
	if (path.startsWith('/api/tenants/') && path.endsWith('/users') && method === 'GET') {
		const tenantId = path.split('/')[3];
		const users = await d1DatabaseService.getUsers(env, tenantId);
		return new Response(JSON.stringify(users), {
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});
	}

	if (path.startsWith('/api/tenants/') && path.endsWith('/users') && method === 'POST') {
		const tenantId = path.split('/')[3];
		const userData = await request.json();
		const user = await d1DatabaseService.createUser(env, tenantId, userData);
		return new Response(JSON.stringify(user), {
			status: 201,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});
	}

	// --- Tenant management routes ---
	if (path === '/api/tenants' && method === 'GET') {
		const tenants = await d1DatabaseService.listTenants(env);
		return new Response(JSON.stringify(tenants), {
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});
	}

	if (path === '/api/tenants' && method === 'POST') {
		const tenantData = await request.json();
		const tenant = await d1DatabaseService.createTenant(env, tenantData);
		return new Response(JSON.stringify(tenant), {
			status: 201,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});
	}

	if (path.startsWith('/api/tenants/') && method === 'GET') {
		const tenantId = path.split('/')[3];
		const tenant = await d1DatabaseService.getTenant(env, tenantId);
		if (!tenant) {
			return new Response(JSON.stringify({ error: 'Tenant not found' }), {
				status: 404,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}
		return new Response(JSON.stringify(tenant), {
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});
	}

	// Health check route
	if (path === '/api/health' && method === 'GET') {
		return new Response(JSON.stringify({ 
			status: 'healthy', 
			timestamp: new Date().toISOString(),
			environment: env.NODE_ENV || 'development'
		}), {
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});
	}

	// Test route for D1 connection
	if (path === '/api/test-d1' && method === 'GET') {
		try {
			// Test D1 connection by running a simple query
			const { results } = await env.DB.prepare('SELECT COUNT(*) as count FROM tenants').all();
			return new Response(JSON.stringify({ 
				message: 'D1 connection successful',
				tenantCount: results[0].count,
				timestamp: new Date().toISOString()
			}), {
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		} catch (error) {
			return new Response(JSON.stringify({ 
				error: 'D1 connection failed',
				details: error.message 
			}), {
				status: 500,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}
	}

	// 404 for unknown API routes
	return new Response(JSON.stringify({ error: 'API route not found' }), {
		status: 404,
		headers: { ...corsHeaders, 'Content-Type': 'application/json' }
	});
}

async function handleStaticRequest(request: Request, env: any) {
	// For now, return a simple HTML response
	// In production, you'd serve your built React app
	return new Response(`
		<!DOCTYPE html>
		<html>
		<head>
			<title>Order Todo App</title>
			<meta charset="utf-8">
			<meta name="viewport" content="width=device-width, initial-scale=1">
		</head>
		<body>
			<h1>Order Todo App - Cloudflare Worker</h1>
			<p>API is running! Try these endpoints:</p>
			<ul>
				<li><a href="/api/health">Health Check</a></li>
				<li><a href="/api/test-d1">Test D1 Connection</a></li>
				<li><a href="/api/tenants">List Tenants</a></li>
			</ul>
			<p>Orders endpoints (require Authorization header):</p>
			<ul>
				<li>GET /api/tenants/:tenantId/orders</li>
				<li>POST /api/tenants/:tenantId/orders</li>
				<li>GET /api/tenants/:tenantId/orders/:orderId</li>
				<li>PUT /api/tenants/:tenantId/orders/:orderId</li>
				<li>DELETE /api/tenants/:tenantId/orders/:orderId</li>
			</ul>
		</body>
		</html>
	`, {
		headers: { 'Content-Type': 'text/html' }
	});
}
