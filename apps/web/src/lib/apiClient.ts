import { fetcher } from './fetcher.js'; // Re-added .js extension due to NodeNext

const apiClient = { get: fetcher, post: fetcher, put: fetcher, delete: fetcher };
export default apiClient; 