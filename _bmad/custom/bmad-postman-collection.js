#!/usr/bin/env node

/**
 * BMad Skill: Postman Collection Generator
 *
 * Scans backend API code and generates a comprehensive Postman collection
 * with role-based test scenarios, authentication flows, and request examples.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '../../..');

// Define all endpoints with metadata
const endpoints = [
    // Auth endpoints
    {
        method: 'POST',
        path: '/api/auth/login',
        name: 'Login',
        description: 'Authenticate with username and password',
        module: 'auth',
        requiresAuth: false,
        permissions: [],
        body: {
            username: 'admin',
            password: 'password123',
        },
        responses: {
            200: 'Returns access token, refresh token, and user info',
            401: 'Invalid credentials',
        },
    },
    {
        method: 'POST',
        path: '/api/auth/refresh',
        name: 'Refresh Token',
        description: 'Refresh access token using refresh token',
        module: 'auth',
        requiresAuth: false,
        permissions: [],
        body: {
            refreshToken: '{{refreshToken}}',
        },
    },
    {
        method: 'POST',
        path: '/api/auth/logout',
        name: 'Logout',
        description: 'Logout current session',
        module: 'auth',
        requiresAuth: true,
        permissions: [],
    },
    {
        method: 'POST',
        path: '/api/auth/logout-all',
        name: 'Logout All Sessions',
        description: 'Logout all active sessions',
        module: 'auth',
        requiresAuth: true,
        permissions: [],
    },
    {
        method: 'GET',
        path: '/api/auth/me',
        name: 'Get Current User',
        description: 'Get authenticated user information',
        module: 'auth',
        requiresAuth: true,
        permissions: [],
    },
    {
        method: 'GET',
        path: '/api/auth/sessions',
        name: 'List User Sessions',
        description: 'List all active sessions for current user',
        module: 'auth',
        requiresAuth: true,
        permissions: [],
    },
    {
        method: 'GET',
        path: '/api/auth/sessions/:uuid',
        name: 'Get Session Details',
        description: 'Get specific session information',
        module: 'auth',
        requiresAuth: true,
        permissions: [],
    },
    {
        method: 'DELETE',
        path: '/api/auth/sessions/:uuid',
        name: 'Revoke Session',
        description: 'Revoke specific session',
        module: 'auth',
        requiresAuth: true,
        permissions: [],
    },

    // Users endpoints
    {
        method: 'GET',
        path: '/api/users',
        name: 'List Users',
        description: 'Get all active users',
        module: 'users',
        requiresAuth: true,
        permissions: ['users.view'],
    },
    {
        method: 'POST',
        path: '/api/users',
        name: 'Create User',
        description: 'Create new user with role',
        module: 'users',
        requiresAuth: true,
        permissions: ['users.create'],
        body: {
            username: 'newuser',
            email: 'user@example.com',
            password: 'password123',
            firstName: 'John',
            lastName: 'Doe',
            phone: '9999999999',
            roleUuid: '{{roleUuid}}',
        },
    },
    {
        method: 'GET',
        path: '/api/users/:uuid',
        name: 'Get User',
        description: 'Get user by UUID',
        module: 'users',
        requiresAuth: true,
        permissions: ['users.view'],
    },
    {
        method: 'PATCH',
        path: '/api/users/:uuid',
        name: 'Update User',
        description: 'Update user information',
        module: 'users',
        requiresAuth: true,
        permissions: ['users.update'],
        body: {
            firstName: 'John',
            lastName: 'Updated',
        },
    },
    {
        method: 'PATCH',
        path: '/api/users/:uuid/status',
        name: 'Update User Status',
        description: 'Update user status (ACTIVE, INACTIVE, SUSPENDED)',
        module: 'users',
        requiresAuth: true,
        permissions: ['users.update'],
        body: {
            status: 'ACTIVE',
        },
    },
    {
        method: 'DELETE',
        path: '/api/users/:uuid',
        name: 'Delete User',
        description: 'Soft delete user',
        module: 'users',
        requiresAuth: true,
        permissions: ['users.delete'],
    },
    {
        method: 'GET',
        path: '/api/users/:userUuid/roles',
        name: 'List User Roles',
        description: 'Get roles assigned to user',
        module: 'users',
        requiresAuth: true,
        permissions: ['users.view'],
    },
    {
        method: 'POST',
        path: '/api/users/:userUuid/roles',
        name: 'Assign Role to User',
        description: 'Assign role to user',
        module: 'users',
        requiresAuth: true,
        permissions: ['users.update'],
        body: {
            roleUuid: '{{roleUuid}}',
        },
    },
    {
        method: 'DELETE',
        path: '/api/users/:userUuid/roles/:roleUuid',
        name: 'Remove User Role',
        description: 'Remove role from user',
        module: 'users',
        requiresAuth: true,
        permissions: ['users.update'],
    },

    // Roles endpoints
    {
        method: 'GET',
        path: '/api/roles',
        name: 'List Roles',
        description: 'Get all roles',
        module: 'roles',
        requiresAuth: true,
        permissions: ['roles.view'],
    },
    {
        method: 'POST',
        path: '/api/roles',
        name: 'Create Role',
        description: 'Create new role',
        module: 'roles',
        requiresAuth: true,
        permissions: ['roles.manage'],
        body: {
            name: 'NEW_ROLE',
            description: 'Description of role',
        },
    },
    {
        method: 'GET',
        path: '/api/roles/:uuid',
        name: 'Get Role',
        description: 'Get role by UUID',
        module: 'roles',
        requiresAuth: true,
        permissions: ['roles.view'],
    },
    {
        method: 'PATCH',
        path: '/api/roles/:uuid',
        name: 'Update Role',
        description: 'Update role information',
        module: 'roles',
        requiresAuth: true,
        permissions: ['roles.manage'],
        body: {
            name: 'UPDATED_ROLE',
            description: 'Updated description',
        },
    },
    {
        method: 'DELETE',
        path: '/api/roles/:uuid',
        name: 'Delete Role',
        description: 'Delete role',
        module: 'roles',
        requiresAuth: true,
        permissions: ['roles.manage'],
    },
    {
        method: 'GET',
        path: '/api/roles/:roleUuid/permissions',
        name: 'List Role Permissions',
        description: 'Get permissions assigned to role',
        module: 'roles',
        requiresAuth: true,
        permissions: ['roles.view'],
    },
    {
        method: 'POST',
        path: '/api/roles/:roleUuid/permissions',
        name: 'Assign Permission to Role',
        description: 'Assign permission to role',
        module: 'roles',
        requiresAuth: true,
        permissions: ['roles.manage'],
        body: {
            permissionUuid: '{{permissionUuid}}',
        },
    },
    {
        method: 'DELETE',
        path: '/api/roles/:roleUuid/permissions/:permissionUuid',
        name: 'Remove Role Permission',
        description: 'Remove permission from role',
        module: 'roles',
        requiresAuth: true,
        permissions: ['roles.manage'],
    },

    // Permissions endpoints
    {
        method: 'GET',
        path: '/api/permissions',
        name: 'List Permissions',
        description: 'Get all permissions',
        module: 'permissions',
        requiresAuth: true,
        permissions: ['roles.view'],
    },
    {
        method: 'POST',
        path: '/api/permissions',
        name: 'Create Permission',
        description: 'Create new permission',
        module: 'permissions',
        requiresAuth: true,
        permissions: ['roles.manage'],
        body: {
            name: 'new.permission',
            description: 'Permission description',
        },
    },
    {
        method: 'GET',
        path: '/api/permissions/:uuid',
        name: 'Get Permission',
        description: 'Get permission by UUID',
        module: 'permissions',
        requiresAuth: true,
        permissions: ['roles.view'],
    },
    {
        method: 'PATCH',
        path: '/api/permissions/:uuid',
        name: 'Update Permission',
        description: 'Update permission information',
        module: 'permissions',
        requiresAuth: true,
        permissions: ['roles.manage'],
        body: {
            name: 'updated.permission',
            description: 'Updated description',
        },
    },
    {
        method: 'DELETE',
        path: '/api/permissions/:uuid',
        name: 'Delete Permission',
        description: 'Delete permission',
        module: 'permissions',
        requiresAuth: true,
        permissions: ['roles.manage'],
    },
];

// Role-based test data
const roles = [
    { name: 'ADMIN', uuid: '{{adminRoleUuid}}', permissions: [] },
    { name: 'MANAGER', uuid: '{{managerRoleUuid}}', permissions: [] },
    { name: 'INVENTORY_MANAGER', uuid: '{{inventoryManagerRoleUuid}}', permissions: [] },
    { name: 'CASHIER', uuid: '{{cashierRoleUuid}}', permissions: [] },
    { name: 'ACCOUNTANT', uuid: '{{accountantRoleUuid}}', permissions: [] },
];

/**
 * Generate Postman collection JSON
 */
function generatePostmanCollection() {
    const collection = {
        info: {
            name: 'IMPOC API',
            description: 'Comprehensive API collection with role-based access control testing',
            schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        auth: {
            type: 'bearer',
            bearer: [
                {
                    key: 'token',
                    value: '{{accessToken}}',
                    type: 'string',
                },
            ],
        },
        item: generateFolders(),
        variable: generateVariables(),
    };

    return collection;
}

/**
 * Generate folder structure by module
 */
function generateFolders() {
    const modules = {};

    endpoints.forEach((endpoint) => {
        if (!modules[endpoint.module]) {
            modules[endpoint.module] = [];
        }
        modules[endpoint.module].push(createRequest(endpoint));
    });

    return Object.entries(modules).map(([moduleName, requests]) => ({
        name: moduleName.charAt(0).toUpperCase() + moduleName.slice(1),
        item: requests,
    }));
}

/**
 * Create individual request
 */
function createRequest(endpoint) {
    const pathParts = endpoint.path.split('/').filter((p) => p);

    const request = {
        name: endpoint.name,
        request: {
            method: endpoint.method,
            header: [
                {
                    key: 'Content-Type',
                    value: 'application/json',
                    type: 'text',
                },
            ],
            description: `${endpoint.description}${
                endpoint.permissions.length > 0
                    ? `\n\nRequired Permission(s): ${endpoint.permissions.join(', ')}`
                    : ''
            }`,
        },
        url: '{{baseUrl}}' + endpoint.path,
        response: generateResponses(endpoint),
    };

    if (endpoint.requiresAuth) {
        request.request.auth = {
            type: 'bearer',
            bearer: [
                {
                    key: 'token',
                    value: '{{accessToken}}',
                    type: 'string',
                },
            ],
        };
    }

    if (endpoint.body) {
        request.request.body = {
            mode: 'raw',
            raw: JSON.stringify(endpoint.body, null, 2),
            options: {
                raw: {
                    language: 'json',
                },
            },
        };
    }

    // Add tests based on endpoint
    request.event = generateTests(endpoint);

    return request;
}

/**
 * Generate test scripts
 */
function generateTests(endpoint) {
    const tests = [];

    tests.push({
        listen: 'test',
        script: {
            exec: [
                'pm.test("Status code is correct", function () {',
                `    pm.expect(pm.response.code).to.be.oneOf([${getExpectedStatusCodes(endpoint).join(', ')}]);`,
                '});',
                '',
                'pm.test("Response is valid JSON", function () {',
                '    pm.response.to.be.json;',
                '});',
                '',
                'pm.test("Response has success flag", function () {',
                '    var jsonData = pm.response.json();',
                '    pm.expect(jsonData).to.have.property("success");',
                '});',
                '',
                '// Save tokens if login endpoint',
                'if (pm.request.url.toString().includes("/login")) {',
                '    var jsonData = pm.response.json();',
                '    pm.environment.set("accessToken", jsonData.data.accessToken);',
                '    pm.environment.set("refreshToken", jsonData.data.refreshToken);',
                '}',
            ].join('\n'),
            type: 'text/javascript',
        },
    });

    return tests;
}

/**
 * Generate response examples
 */
function generateResponses(endpoint) {
    const responses = [];

    if (endpoint.method === 'GET') {
        responses.push({
            name: '200 - Success',
            originalRequest: { method: endpoint.method },
            status: 'OK',
            code: 200,
            body: JSON.stringify({ success: true, data: {} }, null, 2),
        });
    } else if (endpoint.method === 'POST') {
        responses.push({
            name: '201 - Created',
            originalRequest: { method: endpoint.method },
            status: 'Created',
            code: 201,
            body: JSON.stringify({ success: true, data: {} }, null, 2),
        });
    } else if (endpoint.method === 'PATCH' || endpoint.method === 'DELETE') {
        responses.push({
            name: '200 - Updated',
            originalRequest: { method: endpoint.method },
            status: 'OK',
            code: 200,
            body: JSON.stringify({ success: true, data: {} }, null, 2),
        });
    }

    responses.push({
        name: '401 - Unauthorized',
        originalRequest: { method: endpoint.method },
        status: 'Unauthorized',
        code: 401,
        body: JSON.stringify({ success: false, error: 'Unauthorized' }, null, 2),
    });

    if (endpoint.permissions.length > 0) {
        responses.push({
            name: '403 - Forbidden',
            originalRequest: { method: endpoint.method },
            status: 'Forbidden',
            code: 403,
            body: JSON.stringify({ success: false, error: 'Forbidden' }, null, 2),
        });
    }

    responses.push({
        name: '404 - Not Found',
        originalRequest: { method: endpoint.method },
        status: 'Not Found',
        code: 404,
        body: JSON.stringify({ success: false, error: 'Not found' }, null, 2),
    });

    return responses;
}

/**
 * Get expected status codes for endpoint
 */
function getExpectedStatusCodes(endpoint) {
    if (endpoint.method === 'POST' && !endpoint.path.includes('login')) {
        return [201, 409]; // Created or Conflict
    }
    return [200, 404];
}

/**
 * Generate environment variables
 */
function generateVariables() {
    return [
        {
            key: 'baseUrl',
            value: 'http://localhost:5000',
            type: 'string',
        },
        {
            key: 'accessToken',
            value: '',
            type: 'string',
        },
        {
            key: 'refreshToken',
            value: '',
            type: 'string',
        },
        {
            key: 'adminRoleUuid',
            value: '',
            type: 'string',
        },
        {
            key: 'managerRoleUuid',
            value: '',
            type: 'string',
        },
        {
            key: 'inventoryManagerRoleUuid',
            value: '',
            type: 'string',
        },
        {
            key: 'cashierRoleUuid',
            value: '',
            type: 'string',
        },
        {
            key: 'accountantRoleUuid',
            value: '',
            type: 'string',
        },
        {
            key: 'roleUuid',
            value: '',
            type: 'string',
        },
        {
            key: 'permissionUuid',
            value: '',
            type: 'string',
        },
    ];
}

/**
 * Main execution
 */
function main() {
    const outputDir = path.join(projectRoot, 'postman');

    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Generate collection
    const collection = generatePostmanCollection();

    // Write collection to file
    const outputPath = path.join(outputDir, 'postman-collection.json');
    fs.writeFileSync(outputPath, JSON.stringify(collection, null, 2));

    console.log(`✅ Postman collection generated: ${outputPath}`);
    console.log(`📊 Total endpoints: ${endpoints.length}`);
    console.log(`🔐 Roles included: ${roles.map((r) => r.name).join(', ')}`);
}

main();
