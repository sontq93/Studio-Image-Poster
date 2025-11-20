# Studio Ảnh Thương Hiệu AI

Ứng dụng web sử dụng Google Gemini AI để tạo ra các hình ảnh quảng cáo thương hiệu chất lượng cao từ ảnh sản phẩm và người mẫu.

## Tác giả

**Nguyễn Văn Sơn**  
Liên hệ: 0989881732

## Cài đặt và chạy Local

1.  Clone repository về máy:
    ```bash
    git clone <link-repo-cua-ban>
    cd studio-anh-thuong-hieu-ai
    ```

2.  Cài đặt dependencies:
    ```bash
    npm install
    ```

3.  Tạo file `.env` tại thư mục gốc và thêm API Key của bạn:
    ```env
    API_KEY=your_google_gemini_api_key_here
    ```

4.  Chạy ứng dụng:
    ```bash
    npm run dev
    ```

## Triển khai (Deploy)

### Vercel

1.  Đẩy code lên GitHub.
2.  Vào [Vercel Dashboard](https://vercel.com/), chọn "Add New..." -> "Project".
3.  Import repository GitHub của bạn.
4.  Trong phần **Environment Variables**, thêm biến:
    *   **Key**: `API_KEY`
    *   **Value**: (Dán khóa API Google Gemini của bạn vào đây)
5.  Nhấn **Deploy**.

### Netlify

1.  Đẩy code lên GitHub.
2.  Vào [Netlify](https://www.netlify.com/), chọn "Add new site" -> "Import an existing project".
3.  Kết nối với GitHub và chọn repo.
4.  Trong phần "Site settings" -> "Environment variables", thêm biến:
    *   **Key**: `API_KEY`
    *   **Value**: (Khóa API của bạn)
5.  Nhấn **Deploy site**.
