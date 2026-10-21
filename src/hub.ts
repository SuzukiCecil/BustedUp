/** ゲーム集の入口。本番は同じドメインの直下、開発中はローカルの入口（GameHub の開発サーバー） */
export const HUB_URL = import.meta.env.DEV ? 'http://localhost:5182/' : '/'
