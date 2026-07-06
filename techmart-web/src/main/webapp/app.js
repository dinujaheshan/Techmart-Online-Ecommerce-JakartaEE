const API_BASE = window.location.pathname.endsWith('/') 
    ? window.location.pathname + 'api' 
    : window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1) + 'api';

let CURRENT_USER_ID = null;
let isLoggedIn = false;

// Global state
let cartItems = [];
let allProducts = [];
let allCategories = [];
let wishlistItems = [];
let currentUser = {};
let activeCharts = {};
let performanceInterval = null;
let isAdminLoggedIn = false;
let currentAdminUser = {};

const app = {
    checkoutStep: 1,
    selectedPaymentMethod: 'online',
    selectedShippingMethod: 'standard',
    currentSlide: 0,
    carouselInterval: null,
    selectedCategory: 'All',
    currentPage: 1,
    productsPerPage: 6,
    currentProductId: null,
    _renderingProduct: false,

    getProductImage(p, size = 'card') {
        const icons = { 'LP': 'computer', 'SM': 'smartphone', 'HP': 'headset', 'SP': 'volume_up' };
        const prefix = p && p.sku ? p.sku.substring(0, 2) : '';
        const iconName = icons[prefix] || 'inventory_2';
        const fallbackHtml = `<span class="material-icons" style="font-size:${size === 'card' ? '4rem' : '2rem'};display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:var(--primary);">${iconName}</span>`;
        
        if (p && p.imageUrl) {
            return `
                <div style="width:100%;height:100%;position:relative;display:flex;align-items:center;justify-content:center;">
                    <img src="${p.imageUrl}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                    <div style="display:none;width:100%;height:100%;align-items:center;justify-content:center;">${fallbackHtml}</div>
                </div>
            `;
        }
        return fallbackHtml;
    },

    getProductEmoji(sku) {
        if (!sku) return 'inventory_2';
        if (sku.includes('LP')) return 'computer';
        if (sku.includes('SM')) return 'smartphone';
        if (sku.includes('HP')) return 'headset';
        if (sku.includes('SP')) return 'volume_up';
        return 'inventory_2';
    },

    async init() {
        this.initTheme();
        await this.loadSession();
        await this.loadAdminSession();
        await this.loadCategories();
        this.loadProducts();
        this.loadCart();
        this.setupDropdownListeners();
        this.startCarousel();
        this.initScrollReveal();
        window.addEventListener('popstate', (e) => this.handleRouting(e));
        this.handleRouting();
        await this.loadNotifications();
        setInterval(() => this.loadNotifications(), 10000);
    },

    async loadAdminSession() {
        try {
            const res = await fetch(`${API_BASE}/admin/me`);
            if (res.ok) {
                currentAdminUser = await res.json();
                isAdminLoggedIn = true;
            } else {
                currentAdminUser = {};
                isAdminLoggedIn = false;
            }
        } catch (e) {
            currentAdminUser = {};
            isAdminLoggedIn = false;
        }
    },

    handleRouting(event) {
        if (event && event.state && event.state.viewId) {
            this.showView(event.state.viewId, true);
            if (event.state.subViewId && event.state.viewId === 'admin') {
                this.showAdminSubView(event.state.subViewId, true);
            }
            return;
        }

        const path = window.location.pathname;
        let viewId = 'home';
        let subViewId = 'dashboard';

        if (path.includes('/admin')) {
            viewId = 'admin';
            if (path.includes('/admin/')) {
                const sub = path.split('/admin/')[1].split('/')[0];
                if (sub) subViewId = sub;
            }
        } else if (path.includes('/products')) {
            viewId = 'products';
        } else if (path.includes('/cart')) {
            viewId = 'cart';
        } else if (path.includes('/checkout')) {
            viewId = 'checkout';
        } else if (path.includes('/wishlist')) {
            viewId = 'wishlist';
        } else if (path.includes('/profile')) {
            viewId = 'profile';
        } else if (path.includes('/contact')) {
            viewId = 'contact';
        } else if (path.includes('/admin-login')) {
            viewId = 'admin-login';
        }

        if (window.location.hash) {
            const hashView = window.location.hash.replace('#/', '');
            if (hashView) viewId = hashView;
        }

        this.showView(viewId, true);
        if (viewId === 'admin') {
            this.showAdminSubView(subViewId, true);
        }
    },

    async loadSession() {
        try {
            const res = await fetch(`${API_BASE}/users/me`);
            if (res.ok) {
                currentUser = await res.json();
                CURRENT_USER_ID = currentUser.id;
                isLoggedIn = true;
            } else {
                currentUser = {};
                CURRENT_USER_ID = null;
                isLoggedIn = false;
                this.clearAllForms();
            }
        } catch (e) {
            currentUser = {};
            CURRENT_USER_ID = null;
            isLoggedIn = false;
            this.clearAllForms();
        }
        this.updateAuthHeaderUI();
        await this.loadWishlist();
    },

    startCarousel() {
        if (this.carouselInterval) clearInterval(this.carouselInterval);
        this.carouselInterval = setInterval(() => this.nextSlide(), 6000);
    },

    stopCarousel() {
        if (this.carouselInterval) clearInterval(this.carouselInterval);
    },

    setSlide(index) {
        this.currentSlide = index;
        const slides = document.querySelectorAll('.carousel-slide');
        const dots = document.querySelectorAll('.carousel-dot');
        if (slides.length === 0) return;
        
        if (this.currentSlide >= slides.length) this.currentSlide = 0;
        if (this.currentSlide < 0) this.currentSlide = slides.length - 1;

        slides.forEach((slide, i) => {
            if (i === this.currentSlide) {
                slide.classList.add('active');
            } else {
                slide.classList.remove('active');
            }
        });

        dots.forEach((dot, i) => {
            if (i === this.currentSlide) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
        
        this.startCarousel();
    },

    nextSlide() {
        this.setSlide(this.currentSlide + 1);
    },

    prevSlide() {
        this.setSlide(this.currentSlide - 1);
    },

    filterByCategory(categoryName) {
        this.selectedCategory = categoryName;
        const filterSelect = document.getElementById('product-category-filter');
        if (filterSelect) {
            filterSelect.value = categoryName;
        }
        this.showView('products');
        this.renderProductsGrid();
    },

    handleSidebarFilterChange() {
        const filterSelect = document.getElementById('product-category-filter');
        if (filterSelect) {
            this.selectedCategory = filterSelect.value;
        }
        this.renderProductsGrid();
    },

    toggleMobileMenu(e) {
        if (e) e.stopPropagation();
        const nav = document.getElementById('top-nav');
        const icon = document.getElementById('mobile-menu-icon');
        if (!nav) return;
        const isActive = nav.classList.contains('mobile-active');
        if (isActive) {
            nav.classList.remove('mobile-active');
            if (icon) icon.textContent = 'menu';
        } else {
            nav.classList.add('mobile-active');
            if (icon) icon.textContent = 'close';
        }
    },

    closeMobileMenu() {
        const nav = document.getElementById('top-nav');
        const icon = document.getElementById('mobile-menu-icon');
        if (nav) nav.classList.remove('mobile-active');
        if (icon) icon.textContent = 'menu';
    },

    showView(viewId, skipPush = false) {
        this.closeMobileMenu();
        const protectedViews = ['checkout', 'cart', 'wishlist', 'profile'];
        if (!isLoggedIn && protectedViews.includes(viewId)) {
            this.showToast('Please login to access this page.');
            this.openAuthModal('signin');
            return;
        }

        // Clean HTML5 PushState routing without # symbol
        if (!skipPush) {
            const basePath = window.location.pathname.split('#')[0];
            const baseDir = basePath.substring(0, basePath.lastIndexOf('/') + 1) || '/techmart-web/';
            const targetPath = (viewId === 'home' || !viewId) ? baseDir : (baseDir.endsWith('/') ? baseDir + viewId : baseDir + '/' + viewId);
            try {
                if (window.location.pathname !== targetPath || window.location.hash) {
                    history.pushState({ viewId }, '', targetPath);
                }
            } catch (e) {
                // Fallback
            }
        }


        // Toggle Layouts
        if (viewId === 'admin' || viewId === 'admin-login') {
            if (viewId === 'admin') {
                document.getElementById('storefront-layout').style.display = 'none';
                document.getElementById('storefront-header').style.display = 'none';
                document.getElementById('storefront-footer').style.display = 'none';
                if (isAdminLoggedIn && currentAdminUser && currentAdminUser.role === 'ADMIN') {
                    document.getElementById('admin-layout').style.display = 'flex';
                    this.showAdminSubView('dashboard');
                } else {
                    this.showView('admin-login');
                }
            } else {
                // Keep storefront-layout displayed to render view-admin-login, but hide header/footer
                document.getElementById('admin-layout').style.display = 'none';
                document.getElementById('storefront-header').style.display = 'none';
                document.getElementById('storefront-footer').style.display = 'none';
                document.getElementById('storefront-layout').style.display = 'block';
                
                document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
                document.getElementById('view-admin-login').classList.add('active');
            }
            return;
        } else {
            document.getElementById('admin-layout').style.display = 'none';
            document.getElementById('storefront-header').style.display = 'block';
            document.getElementById('storefront-layout').style.display = 'block';
            document.getElementById('storefront-footer').style.display = 'block';
            if (performanceInterval) {
                clearInterval(performanceInterval);
                performanceInterval = null;
            }
        }

        // Handle Storefront Views
        document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
        document.getElementById('view-' + viewId).classList.add('active');
        window.scrollTo(0, 0);

        // Breadcrumb logic
        const breadcrumb = document.getElementById('breadcrumb');
        const breadcrumbText = document.getElementById('breadcrumb-current');
        if (viewId === 'home') {
            breadcrumb.style.display = 'none';
        } else {
            breadcrumb.style.display = 'block';
            if (viewId === 'products') breadcrumbText.innerHTML = 'Products';
            if (viewId === 'product-details') breadcrumbText.innerHTML = '<a href="#" onclick="app.showView(\'products\')">Products</a> / Details';
            if (viewId === 'admin-login') breadcrumbText.innerHTML = 'Admin Login';
            if (viewId === 'cart') breadcrumbText.innerHTML = 'Shopping Cart';
            if (viewId === 'checkout') breadcrumbText.innerHTML = '<a href="#" onclick="app.showView(\'cart\')">Cart</a> / Checkout';
            if (viewId === 'profile') breadcrumbText.innerHTML = 'My Profile';
            if (viewId === 'wishlist') breadcrumbText.innerHTML = 'My Wishlist';
            if (viewId === 'contact') breadcrumbText.innerHTML = 'Contact Us';
        }

        // Active Nav State
        document.querySelectorAll('.top-nav a').forEach(a => a.classList.remove('active'));
        if (viewId === 'home') document.querySelectorAll('.top-nav a')[0].classList.add('active');
        if (viewId === 'products') document.querySelectorAll('.top-nav a')[1].classList.add('active');
        if (viewId === 'contact') document.querySelectorAll('.top-nav a')[2].classList.add('active');

        // View specific refresh
        if (viewId === 'products') this.renderProductsGrid();
        if (viewId === 'checkout') {
            this.checkoutStep = 1;
            this.selectedPaymentMethod = 'online';
            this.selectedShippingMethod = 'standard';
            this.setCheckoutStep(1);
            this.selectPaymentMethod('online');
            this.selectShippingMethod('standard');
            this.renderCheckoutReview();
            this.prefillCheckoutAddress();
        }
        if (viewId === 'profile') this.renderUserProfileAndOrders();
        if (viewId === 'wishlist') this.renderWishlistGrid();
    },

    formatCurrency(amount) {
        return '$' + parseFloat(amount).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    },

    // ---- SCROLL REVEAL (Intersection Observer) ----
    _scrollObserver: null,

    initScrollReveal() {
        if (this._scrollObserver) this._scrollObserver.disconnect();
        this._scrollObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('show');
                    this._scrollObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });

        document.querySelectorAll('.reveal').forEach(el => {
            this._scrollObserver.observe(el);
        });
    },

    refreshReveal() {
        document.querySelectorAll('.reveal:not(.show)').forEach(el => {
            if (this._scrollObserver) this._scrollObserver.observe(el);
        });
    },

    showToast(msg) {
        const toast = document.getElementById('telemetry-toast');
        toast.textContent = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    },

    async loadProducts() {
        try {
            const res = await fetch(`${API_BASE}/products`);
            allProducts = await res.json();
            this.renderFeaturedProducts();
            this.renderProductsGrid();
        } catch (e) {
            console.error(e);
        }
    },

    renderFeaturedProducts() {
        const grid = document.getElementById('featured-products');
        if (!grid) return;
        grid.innerHTML = '';
        
        // Take first 4
        const featured = allProducts.slice(0, 4);
        featured.forEach((p, idx) => {
            const imgHtml = this.getProductImage(p, 'card');
            const isWishlisted = wishlistItems.some(item => item.product.id === p.id);
            const heartSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;
            const delay = Math.min(idx + 1, 10);
            grid.innerHTML += `
                <div class="product-card reveal" data-delay="${delay}">
                    <div class="product-img" onclick="app.showProductDetails(${p.id})" style="cursor:pointer;">${imgHtml}</div>
                    <div class="product-meta">
                        <span class="product-cat">${p.category ? p.category.name : 'Accessories'}</span>
                        <span class="product-stock"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg> In Stock</span>
                    </div>
                    <h3 onclick="app.showProductDetails(${p.id})" style="cursor:pointer;">${p.name}</h3>
                    <div class="price">${this.formatCurrency(p.price)}</div>
                    <div class="product-actions">
                        <button class="btn btn-outline" onclick="app.showProductDetails(${p.id})">View Details</button>
                        <button class="btn btn-wishlist ${isWishlisted ? 'active' : ''}" onclick="app.toggleWishlist(${p.id}, event)">${heartSvg}</button>
                        <button class="btn btn-primary" onclick="app.addToCart(${p.id})"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg></button>
                    </div>
                </div>
            `;
        });
        setTimeout(() => this.refreshReveal(), 50);
    },

    applySidebarFilters() {
        this.renderProductsGrid();
    },

    renderProductsGrid() {
        const grid = document.getElementById('full-product-grid');
        const count = document.getElementById('products-count');
        if (!grid) return;
        
        grid.innerHTML = '';
        
        let filteredProducts = [...allProducts];

        // 1. Category Filter
        const catEl = document.getElementById('product-category-filter');
        const categoryVal = catEl ? catEl.value : this.selectedCategory;
        if (categoryVal !== 'All') {
            filteredProducts = filteredProducts.filter(p => p.category && p.category.name === categoryVal);
        }

        // 2. Search Filter
        const searchEl = document.getElementById('product-search-filter');
        const searchVal = searchEl ? searchEl.value.toLowerCase().trim() : '';
        if (searchVal) {
            filteredProducts = filteredProducts.filter(p => 
                p.name.toLowerCase().includes(searchVal) || 
                (p.sku && p.sku.toLowerCase().includes(searchVal)) ||
                (p.description && p.description.toLowerCase().includes(searchVal))
            );
        }

        // 3. Price Filter
        const priceEl = document.getElementById('product-price-filter');
        const priceVal = priceEl ? priceEl.value : 'Any';
        if (priceVal !== 'Any') {
            if (priceVal === 'Under 500') {
                filteredProducts = filteredProducts.filter(p => parseFloat(p.price) < 500);
            } else if (priceVal === '500-1500') {
                filteredProducts = filteredProducts.filter(p => parseFloat(p.price) >= 500 && parseFloat(p.price) <= 1500);
            } else if (priceVal === 'Over 1500') {
                filteredProducts = filteredProducts.filter(p => parseFloat(p.price) > 1500);
            }
        }

        // 4. Brand Filter
        const checkedBrands = Array.from(document.querySelectorAll('.brand-filter-checkbox:checked')).map(cb => cb.value.toLowerCase());
        if (checkedBrands.length > 0) {
            filteredProducts = filteredProducts.filter(p => {
                const nameLower = p.name.toLowerCase();
                return checkedBrands.some(brand => nameLower.includes(brand));
            });
        }

        const sortByEl = document.getElementById('product-sort-by');
        const sortBy = sortByEl ? sortByEl.value : 'Featured';

        if (sortBy === 'Price: Low to High') {
            filteredProducts.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
        } else if (sortBy === 'Price: High to Low') {
            filteredProducts.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
        } else if (sortBy === 'Name') {
            filteredProducts.sort((a, b) => a.name.localeCompare(b.name));
        }

        const totalProductsCount = filteredProducts.length;
        count.textContent = `Showing ${totalProductsCount} products`;

        if (totalProductsCount === 0) {
            grid.innerHTML = '<div style="grid-column: 1/-1; padding: 3rem 0; text-align: center; color: var(--text-muted); font-size:1.1rem;">No products in this category.</div>';
            const paginationContainer = document.getElementById('product-pagination');
            if (paginationContainer) paginationContainer.innerHTML = '';
            return;
        }

        const totalPages = Math.ceil(totalProductsCount / this.productsPerPage);
        if (this.currentPage > totalPages) {
            this.currentPage = totalPages;
        }
        if (this.currentPage < 1) {
            this.currentPage = 1;
        }

        const startIndex = (this.currentPage - 1) * this.productsPerPage;
        const endIndex = startIndex + this.productsPerPage;
        const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

        paginatedProducts.forEach((p, idx) => {
            const imgHtml = this.getProductImage(p, 'card');
            const isWishlisted = wishlistItems.some(item => item.product.id === p.id);
            const heartSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;
            const delay = Math.min(idx + 1, 10);
            grid.innerHTML += `
                <div class="product-card reveal" data-delay="${delay}">
                    <div class="product-img" onclick="app.showProductDetails(${p.id})" style="cursor:pointer;">${imgHtml}</div>
                    <div class="product-meta">
                        <span class="product-cat">${p.category ? p.category.name : 'Accessories'}</span>
                        <span class="product-stock"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg> In Stock</span>
                    </div>
                    <h3 onclick="app.showProductDetails(${p.id})" style="cursor:pointer;">${p.name}</h3>
                    <div class="price">${this.formatCurrency(p.price)}</div>
                    <div class="product-actions">
                        <button class="btn btn-outline" onclick="app.showProductDetails(${p.id})">Details</button>
                        <button class="btn btn-wishlist ${isWishlisted ? 'active' : ''}" onclick="app.toggleWishlist(${p.id}, event)">${heartSvg}</button>
                        <button class="btn btn-primary" onclick="app.addToCart(${p.id})"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg></button>
                    </div>
                </div>
            `;
        });

        this.renderPagination(totalPages);
        setTimeout(() => this.refreshReveal(), 50);
    },

    renderPagination(totalPages) {
        const paginationContainer = document.getElementById('product-pagination');
        if (!paginationContainer) return;
        
        paginationContainer.innerHTML = '';
        if (totalPages <= 1) return;

        // Prev button
        paginationContainer.innerHTML += `
            <button class="page-btn ${this.currentPage === 1 ? 'disabled' : ''}" onclick="app.setPage(${this.currentPage - 1})" ${this.currentPage === 1 ? 'disabled' : ''}>&lsaquo;</button>
        `;

        // Page numbers
        for (let i = 1; i <= totalPages; i++) {
            paginationContainer.innerHTML += `
                <button class="page-btn ${this.currentPage === i ? 'active' : ''}" onclick="app.setPage(${i})">${i}</button>
            `;
        }

        // Next button
        paginationContainer.innerHTML += `
            <button class="page-btn ${this.currentPage === totalPages ? 'disabled' : ''}" onclick="app.setPage(${this.currentPage + 1})" ${this.currentPage === totalPages ? 'disabled' : ''}>&rsaquo;</button>
        `;
    },

    setPage(page) {
        this.currentPage = page;
        this.renderProductsGrid();
        const mainEl = document.querySelector('.products-main');
        if (mainEl) {
            mainEl.scrollIntoView({ behavior: 'smooth' });
        }
    },

    showProductDetails(productId) {
        this.currentProductId = productId;
        // Build content then switch view
        this._showProductDetailsDOM(productId);
    },

    _showProductDetailsDOM(productId) {
        const product = allProducts.find(p => p.id === productId);
        if (!product) return;

        // --- 1. Build HTML content first ---
        const imgHtml = this.getProductImage(product, 'large');
        const isWishlisted = wishlistItems.some(item => item.product.id === product.id);
        const catName = product.category ? product.category.name : 'Accessories';
        const price = parseFloat(product.price);
        const originalPrice = (price * 1.15).toFixed(2);
        const discount = 15;

        const related = allProducts
            .filter(p => p.id !== product.id && p.category && product.category && p.category.name === product.category.name)
            .slice(0, 4);

        const specsMap = {
            'Laptops':    [['Processor','Latest Gen Intel/AMD'],['RAM','Up to 32GB DDR5'],['Storage','Up to 1TB NVMe SSD'],['Display','FHD / 4K IPS Panel'],['Battery','Up to 12 hrs']],
            'Phones':     [['Display','6.7" AMOLED 120Hz'],['Processor','Flagship Chipset'],['Camera','108MP Triple Camera'],['Battery','5000mAh Fast Charge'],['OS','Android 14 / iOS 17']],
            'Headphones': [['Driver','40mm Dynamic'],['Frequency','20Hz – 20kHz'],['Connectivity','Bluetooth 5.3'],['Battery','30hr Playback'],['ANC','Active Noise Cancelling']],
            'Speakers':   [['Output Power','60W RMS'],['Frequency','50Hz – 20kHz'],['Connectivity','Bluetooth 5.0, AUX'],['Battery','24hr Playback'],['Waterproof','IPX5 Rated']],
        };
        const specs = specsMap[catName] || [['Category', catName], ['SKU', product.sku || 'N/A']];

        const specsHTML = specs.map(([k, v]) => `
            <div class="pd-spec-row">
                <span class="pd-spec-key">${k}</span>
                <span class="pd-spec-val">${v}</span>
            </div>`).join('');

        const relatedHTML = related.length ? `
            <div class="pd-related-section">
                <h3 class="pd-related-title">Related Products</h3>
                <div class="pd-related-grid">
                    ${related.map(rp => {
                        const rImg = this.getProductImage(rp, 'card');
                        return `<div class="pd-related-card" onclick="app.showProductDetails(${rp.id})">
                            <div class="pd-related-img">${rImg}</div>
                            <div class="pd-related-info">
                                <div class="pd-related-name">${rp.name}</div>
                                <div class="pd-related-price">${this.formatCurrency(rp.price)}</div>
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            </div>` : '';

        const html = `
            <div class="pd-hero">
                <div class="pd-image-col">
                    <div class="pd-main-img-wrap">${imgHtml}</div>
                    <div class="pd-thumb-row">
                        <div class="pd-thumb active">${imgHtml}</div>
                        <div class="pd-thumb" style="opacity:0.4;">${imgHtml}</div>
                        <div class="pd-thumb" style="opacity:0.4;">${imgHtml}</div>
                    </div>
                </div>
                <div class="pd-info-col">
                    <span class="pd-category-badge">${catName}</span>
                    <h1 class="pd-product-name">${product.name}</h1>
                    <div class="pd-sku-line">SKU: <strong>${product.sku || 'N/A'}</strong></div>
                    <div class="pd-rating-row">
                        <div class="pd-stars">
                            <span class="material-icons" style="color:#f59e0b;font-size:1.1rem;">star</span>
                            <span class="material-icons" style="color:#f59e0b;font-size:1.1rem;">star</span>
                            <span class="material-icons" style="color:#f59e0b;font-size:1.1rem;">star</span>
                            <span class="material-icons" style="color:#f59e0b;font-size:1.1rem;">star</span>
                            <span class="material-icons" style="color:#d1d5db;font-size:1.1rem;">star</span>
                        </div>
                        <span class="pd-rating-text">4.0 <span style="color:var(--text-muted);">(128 reviews)</span></span>
                    </div>
                    <div class="pd-price-block">
                        <span class="pd-current-price">${this.formatCurrency(price)}</span>
                        <span class="pd-original-price">${this.formatCurrency(originalPrice)}</span>
                        <span class="pd-discount-badge">-${discount}%</span>
                    </div>
                    <div class="pd-availability">
                        <span class="material-icons" style="color:var(--success);font-size:1rem;">check_circle</span>
                        <span style="color:var(--success);font-weight:600;font-size:0.9rem;">In Stock</span>
                        <span style="color:var(--text-muted);font-size:0.85rem;margin-left:0.5rem;">— Ships within 24 hours</span>
                    </div>
                    <p class="pd-desc">${product.description || 'High-performance tech product from TechMart Online. Engineered for reliability and built for professionals who demand the best.'}</p>
                    <div class="pd-qty-row">
                        <label style="font-size:0.85rem;color:var(--text-muted);font-weight:500;">Quantity</label>
                        <div class="pd-qty-ctrl">
                            <button class="pd-qty-btn" onclick="this.nextElementSibling.value=Math.max(1,+this.nextElementSibling.value-1)">−</button>
                            <input type="number" id="pd-qty-input" class="pd-qty-input" value="1" min="1" max="99">
                            <button class="pd-qty-btn" onclick="this.previousElementSibling.value=Math.min(99,+this.previousElementSibling.value+1)">+</button>
                        </div>
                    </div>
                    <div class="pd-action-row">
                        <button class="btn btn-primary pd-btn-main" id="detail-page-cart-btn">
                            <span class="material-icons" style="font-size:1rem;">shopping_cart</span> Add to Cart
                        </button>
                        <button class="btn pd-btn-buynow" id="detail-page-buy-btn">
                            <span class="material-icons" style="font-size:1rem;">bolt</span> Buy Now
                        </button>
                        <button class="btn btn-wishlist pd-btn-wish ${isWishlisted ? 'active' : ''}" id="detail-page-wishlist-btn" title="Wishlist">
                            <span class="material-icons" style="font-size:1.2rem;${isWishlisted ? 'color:var(--danger);' : ''}">favorite${isWishlisted ? '' : '_border'}</span>
                        </button>
                    </div>
                    <div class="pd-trust-row">
                        <div class="pd-trust-item"><span class="material-icons" style="color:var(--success);font-size:1rem;">local_shipping</span> Free Delivery</div>
                        <div class="pd-trust-item"><span class="material-icons" style="color:var(--primary);font-size:1rem;">replay</span> 30-Day Returns</div>
                        <div class="pd-trust-item"><span class="material-icons" style="color:var(--warning);font-size:1rem;">security</span> Secure Payment</div>
                        <div class="pd-trust-item"><span class="material-icons" style="color:var(--text-muted);font-size:1rem;">verified</span> Warranty</div>
                    </div>
                </div>
            </div>
            <div class="pd-tabs-section">
                <div class="pd-tabs">
                    <button class="pd-tab active" onclick="app.switchPdTab(this,'pd-tab-specs')">Specifications</button>
                    <button class="pd-tab" onclick="app.switchPdTab(this,'pd-tab-desc')">Description</button>
                    <button class="pd-tab" onclick="app.switchPdTab(this,'pd-tab-shipping')">Shipping &amp; Returns</button>
                </div>
                <div class="pd-tab-content" id="pd-tab-specs"><div class="pd-specs-grid">${specsHTML}</div></div>
                <div class="pd-tab-content" id="pd-tab-desc" style="display:none;">
                    <p style="line-height:1.8;color:var(--text-main);">${product.description || 'Premium tech from TechMart Online.'}</p>
                </div>
                <div class="pd-tab-content" id="pd-tab-shipping" style="display:none;">
                    <div class="pd-shipping-info">
                        <div class="pd-ship-item"><span class="material-icons" style="color:var(--success);">local_shipping</span><div><strong>Free Standard Shipping</strong><p>Delivered in 3-5 business days.</p></div></div>
                        <div class="pd-ship-item"><span class="material-icons" style="color:var(--primary);">bolt</span><div><strong>Express Delivery</strong><p>Available for $15. Ships within 24 hours.</p></div></div>
                        <div class="pd-ship-item"><span class="material-icons" style="color:var(--warning);">replay</span><div><strong>30-Day Returns</strong><p>Hassle-free returns on all products.</p></div></div>
                    </div>
                </div>
            </div>
            ${relatedHTML}
        `;

        // --- 2. Populate container ---
        const container = document.getElementById('product-details-container');
        if (container) container.innerHTML = html;

        // --- 3. Switch view WITHOUT triggering hashchange ---
        // Use replaceState so no hashchange event fires
        document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
        const section = document.getElementById('view-product-details');
        if (section) section.classList.add('active');
        window.scrollTo(0, 0);

        // Keep URL clean without hash
        if (window.location.hash) {
            history.replaceState(null, '', window.location.pathname + window.location.search);
        }


        // Update header/footer/admin layout
        const adminLayout = document.getElementById('admin-layout');
        if (adminLayout) adminLayout.style.display = 'none';
        const header = document.getElementById('storefront-header');
        if (header) header.style.display = 'block';
        const layout = document.getElementById('storefront-layout');
        if (layout) layout.style.display = 'block';
        const footer = document.getElementById('storefront-footer');
        if (footer) footer.style.display = 'block';

        // Breadcrumb
        const breadcrumb = document.getElementById('breadcrumb');
        const breadcrumbText = document.getElementById('breadcrumb-current');
        if (breadcrumb) breadcrumb.style.display = 'block';
        if (breadcrumbText) breadcrumbText.innerHTML = '<a href="#" onclick="app.showView(\'products\')">Products</a> / ' + product.name;

        // --- 4. Bind action buttons ---
        const cartBtn = document.getElementById('detail-page-cart-btn');
        if (cartBtn) cartBtn.onclick = () => {
            const qty = parseInt(document.getElementById('pd-qty-input')?.value || 1);
            for (let i = 0; i < qty; i++) this.addToCart(product.id);
        };
        const buyBtn = document.getElementById('detail-page-buy-btn');
        if (buyBtn) buyBtn.onclick = () => {
            const qty = parseInt(document.getElementById('pd-qty-input')?.value || 1);
            for (let i = 0; i < qty; i++) this.addToCart(product.id);
            this.showView('cart');
        };
        const wishBtn = document.getElementById('detail-page-wishlist-btn');
        if (wishBtn) wishBtn.onclick = (e) => this.toggleWishlist(product.id, e);
    },


    switchPdTab(btnEl, tabId) {

        document.querySelectorAll('.pd-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.pd-tab-content').forEach(c => c.style.display = 'none');
        btnEl.classList.add('active');
        const tab = document.getElementById(tabId);
        if (tab) tab.style.display = 'block';
    },

    async addToCart(productId) {
        if (!isLoggedIn) {
            this.showToast('Please login to add items to cart.');
            this.openAuthModal('signin');
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/cart/add?productId=${productId}&quantity=1`, { method: 'POST' });
            if (res.ok) {
                this.showToast('Added to Cart');
                this.loadCart();
            }
        } catch (e) {
            console.error(e);
        }
    },

    async removeFromCart(productId) {
        try {
            const res = await fetch(`${API_BASE}/cart/remove/${productId}`, { method: 'DELETE' });
            if (res.ok) {
                this.showToast('Removed from Cart');
                this.loadCart();
            }
        } catch (e) {
            console.error(e);
        }
    },

    async clearCart() {
        try {
            const res = await fetch(`${API_BASE}/cart/clear`, { method: 'POST' });
            if (res.ok) {
                this.showToast('Cart Cleared');
                this.loadCart();
            }
        } catch (e) {
            console.error(e);
        }
    },

    async loadCart() {
        try {
            const res = await fetch(`${API_BASE}/cart`);
            cartItems = await res.json();
            
            let total = 0;
            let qty = 0;
            const list = document.getElementById('cart-items-list');
            if (list) list.innerHTML = '';

            cartItems.forEach(item => {
                const itemTotal = item.product.price * item.quantity;
                total += itemTotal;
                qty += item.quantity;
                
                const imgHtml = this.getProductImage(item.product, 'small');

                if (list) {
                    list.innerHTML += `
                        <div class="cart-item-row">
                            <div class="col-product">
                                <div class="cart-item-img">${imgHtml}</div>
                                <div>
                                    <div class="cart-item-name">${item.product.name}</div>
                                    <div class="text-muted" style="font-size:0.8rem;">SKU: ${item.product.sku}</div>
                                </div>
                            </div>
                            <div class="col-price" style="font-weight:600;">${this.formatCurrency(item.product.price)}</div>
                            <div class="col-qty">
                                <input type="number" class="qty-input" value="${item.quantity}" readonly>
                                <button class="btn btn-outline" style="padding: 0.3rem 0.6rem; margin-left: 0.5rem; font-size: 0.8rem;">Update</button>
                            </div>
                            <div class="col-subtotal" style="font-weight:600;">${this.formatCurrency(itemTotal)} <button class="btn" onclick="app.removeFromCart(${item.product.id})" style="color:var(--danger); padding: 0.3rem; margin-left: 0.5rem;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button></div>
                        </div>
                    `;
                }
            });

            if (list && cartItems.length === 0) {
                list.innerHTML = '<div style="padding: 2rem 0; text-align: center; color: var(--text-muted);">Your cart is empty.</div>';
            }

            document.getElementById('cart-badge').textContent = qty;
            
            const tax = total * 0.08; // 8% tax mock
            const finalTotal = total + tax;

            if (document.getElementById('summary-subtotal')) {
                document.getElementById('summary-subtotal').textContent = this.formatCurrency(total);
                document.getElementById('summary-tax').textContent = this.formatCurrency(tax);
                document.getElementById('summary-total').textContent = this.formatCurrency(finalTotal);
            }
        } catch (e) {
            console.error(e);
        }
    },

    renderCheckoutReview() {
        const container = document.getElementById('checkout-review-items');
        if (!container) return;
        container.innerHTML = '';
        
        let total = 0;
        cartItems.forEach(item => {
            const itemTotal = item.product.price * item.quantity;
            total += itemTotal;
            const imgHtml = this.getProductImage(item.product, 'small');
            
            container.innerHTML += `
                <div class="review-item">
                    <div class="review-item-img" style="display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:4px;">${imgHtml}</div>
                    <div class="review-item-details">
                        <div style="font-weight:500;">${item.product.name}</div>
                        <div class="text-muted" style="font-size:0.8rem;">Qty: ${item.quantity}</div>
                    </div>
                    <div style="font-weight:600;">${this.formatCurrency(itemTotal)}</div>
                </div>
            `;
        });

        const tax = total * 0.08;
        const shipping = (this.selectedShippingMethod === 'express') ? 15.00 : 0;
        const finalTotal = total + tax + shipping;

        document.getElementById('checkout-subtotal').textContent = this.formatCurrency(total);
        document.getElementById('checkout-tax').textContent = this.formatCurrency(tax);
        document.getElementById('checkout-total').textContent = this.formatCurrency(finalTotal);
    },

    async placeOrder() {
        if (this.checkoutStep !== 3) {
            alert('Please complete the shipping and payment steps first.');
            return;
        }

        const email = document.getElementById('checkout-email').value;
        const address = document.getElementById('checkout-address').value;
        if (!address) {
            alert('Please enter a street address.');
            return;
        }

        const userIdToPass = CURRENT_USER_ID || 1;

        try {
            // 1. Create Order in Database
            const res = await fetch(`${API_BASE}/orders/checkout?userId=${userIdToPass}&shippingAddress=${encodeURIComponent(address)}&email=${encodeURIComponent(email)}&paymentMethod=${encodeURIComponent(this.selectedPaymentMethod)}`, { method: 'POST' });
            if (res.ok) {
                const order = await res.json();
                this.showToast('Order Placed Successfully!');
                this.showView('home');
                this.loadCart();
            } else {
                alert('Checkout failed to create order.');
            }
        } catch (e) {
            console.error(e);
            alert('An error occurred during checkout.');
        }
    },

    setCheckoutStep(step) {
        this.checkoutStep = step;
        
        for (let i = 1; i <= 3; i++) {
            const panel = document.getElementById(`checkout-step-panel-${i}`);
            const indicator = document.getElementById(`checkout-step-indicator-${i}`);
            if (panel) {
                panel.style.display = (i === step) ? 'block' : 'none';
            }
            if (indicator) {
                indicator.classList.remove('active', 'completed');
                if (i < step) {
                    indicator.classList.add('completed');
                } else if (i === step) {
                    indicator.classList.add('active');
                }
            }
        }
        
        if (step === 3) {
            this.populateCheckoutReview();
        }
    },

    nextCheckoutStep() {
        if (this.checkoutStep === 1) {
            const firstName = document.getElementById('checkout-first-name').value.trim();
            const lastName = document.getElementById('checkout-last-name').value.trim();
            const email = document.getElementById('checkout-email').value.trim();
            const address = document.getElementById('checkout-address').value.trim();
            const city = document.getElementById('checkout-city').value.trim();
            const state = document.getElementById('checkout-state').value.trim();
            const zip = document.getElementById('checkout-zip').value.trim();
            const phone = document.getElementById('checkout-phone').value.trim();
            
            if (!firstName || !lastName || !email || !address || !city || !state || !zip || !phone) {
                alert('Please fill in all required shipping fields.');
                return;
            }
            this.setCheckoutStep(2);
        } else if (this.checkoutStep === 2) {
            this.setCheckoutStep(3);
        }
    },

    prevCheckoutStep() {
        if (this.checkoutStep > 1) {
            this.setCheckoutStep(this.checkoutStep - 1);
        }
    },

    selectPaymentMethod(method) {
        this.selectedPaymentMethod = method;
        
        const tabs = ['online', 'pay', 'bank'];
        tabs.forEach(t => {
            const tabBtn = document.getElementById(`pay-tab-${t}`);
            const content = document.getElementById(`payment-content-${t}`);
            if (tabBtn) {
                if (t === method) {
                    tabBtn.classList.add('active');
                } else {
                    tabBtn.classList.remove('active');
                }
            }
            if (content) {
                content.style.display = (t === method) ? 'block' : 'none';
            }
        });
    },

    selectShippingMethod(method) {
        this.selectedShippingMethod = method;
        
        const standardCard = document.getElementById('shipping-method-standard');
        const expressCard = document.getElementById('shipping-method-express');
        const standardRadio = document.getElementById('shipping-radio-standard');
        const expressRadio = document.getElementById('shipping-radio-express');
        
        if (method === 'standard') {
            if (standardCard) standardCard.classList.add('active');
            if (expressCard) expressCard.classList.remove('active');
            if (standardRadio) standardRadio.checked = true;
            if (expressRadio) expressRadio.checked = false;
        } else {
            if (standardCard) standardCard.classList.remove('active');
            if (expressCard) expressCard.classList.add('active');
            if (standardRadio) standardRadio.checked = false;
            if (expressRadio) expressRadio.checked = true;
        }
        
        this.renderCheckoutReview();
    },

    updateCardMockup() {
        const cardNum = document.getElementById('checkout-card-number').value;
        const cardName = document.getElementById('checkout-card-name').value;
        const cardExpiry = document.getElementById('checkout-card-expiry').value;
        
        let formattedNum = cardNum.replace(/\s?/g, '').replace(/(\d{4})/g, '$1 ').trim();
        document.getElementById('checkout-card-number').value = formattedNum;
        
        const ccNumMock = document.getElementById('cc-mockup-number');
        if (ccNumMock) {
            ccNumMock.textContent = formattedNum || '•••• •••• •••• ••••';
        }
        
        const ccNameMock = document.getElementById('cc-mockup-name');
        if (ccNameMock) {
            ccNameMock.textContent = (cardName || 'Tharushi Nethmini').toUpperCase();
        }
        
        let expiryVal = cardExpiry.replace(/\//g, '');
        if (expiryVal.length > 2) {
            expiryVal = expiryVal.substring(0, 2) + '/' + expiryVal.substring(2, 4);
        }
        document.getElementById('checkout-card-expiry').value = expiryVal;
        
        const ccExpiryMock = document.getElementById('cc-mockup-expiry');
        if (ccExpiryMock) {
            ccExpiryMock.textContent = expiryVal || 'MM/YY';
        }
        
        const ccLogo = document.getElementById('cc-logo');
        if (ccLogo) {
            if (cardNum.startsWith('5')) {
                ccLogo.textContent = 'MASTERCARD';
            } else if (cardNum.startsWith('3')) {
                ccLogo.textContent = 'AMEX';
            } else {
                ccLogo.textContent = 'VISA';
            }
        }
    },

    populateCheckoutReview() {
        const firstName = document.getElementById('checkout-first-name').value;
        const lastName = document.getElementById('checkout-last-name').value;
        const email = document.getElementById('checkout-email').value;
        const address = document.getElementById('checkout-address').value;
        const city = document.getElementById('checkout-city').value;
        const state = document.getElementById('checkout-state').value;
        const zip = document.getElementById('checkout-zip').value;
        const country = document.getElementById('checkout-country').value;
        const phone = document.getElementById('checkout-phone').value;
        
        const shName = document.getElementById('checkout-review-shipping-name');
        if (shName) shName.textContent = `${firstName} ${lastName}`;
        const shAddr = document.getElementById('checkout-review-shipping-address');
        if (shAddr) shAddr.textContent = address;
        const shCity = document.getElementById('checkout-review-shipping-city');
        if (shCity) shCity.textContent = `${city}, ${state} ${zip}, ${country}`;
        const shPhone = document.getElementById('checkout-review-shipping-phone');
        if (shPhone) shPhone.textContent = `Phone: ${phone}`;
        const shEmail = document.getElementById('checkout-review-shipping-email');
        if (shEmail) shEmail.textContent = `Email: ${email}`;
        
        const methodVal = (this.selectedShippingMethod === 'express') ? 'Express Shipping ($15.00)' : 'Standard Shipping (Free)';
        const revMethod = document.getElementById('checkout-review-method-val');
        if (revMethod) revMethod.textContent = methodVal;
        
        let paymentVal = 'Credit Card';
        if (this.selectedPaymentMethod === 'pay') paymentVal = 'TechMart Pay';
        if (this.selectedPaymentMethod === 'bank') paymentVal = 'Bank Transfer';
        const revPay = document.getElementById('checkout-review-payment-val');
        if (revPay) revPay.textContent = paymentVal;
    },

    // --- ADMIN DASHBOARD ---
    async loadAdminData() {
        try {
            const res = await fetch(`${API_BASE}/admin/orders`);
            const orders = await res.json();
            
            const tbody = document.getElementById('admin-orders-body');
            tbody.innerHTML = '';
            
            orders.forEach(o => {
                let statusBadge = '';
                if (o.status === 'PENDING') statusBadge = '<span class="badge" style="background:#fef3c7; color:#d97706; padding:0.4rem 0.8rem;">Pending</span>';
                if (o.status === 'COMPLETED') statusBadge = '<span class="badge" style="background:#d1fae5; color:#059669; padding:0.4rem 0.8rem;">Delivered</span>';
                if (o.status === 'PROCESSING') statusBadge = '<span class="badge" style="background:#dbeafe; color:#2563eb; padding:0.4rem 0.8rem;">Processing</span>';
                
                tbody.innerHTML += `
                    <tr>
                        <td style="font-weight:600; color:var(--primary);">#TM-2026-${1000 + o.id}</td>
                        <td>User ${o.user.id}</td>
                        <td>${new Date(o.orderDate).toLocaleDateString()}</td>
                        <td style="font-weight:600;">${this.formatCurrency(o.totalAmount)}</td>
                        <td>${statusBadge}</td>
                        <td><button class="btn btn-outline" style="padding:0.3rem 0.6rem; font-size:0.8rem;">View</button></td>
                    </tr>
                `;
            });
            
            // Stats updates mock
            document.querySelector('.stat-card:nth-child(1) .value').textContent = this.formatCurrency(orders.reduce((sum, o) => sum + o.totalAmount, 0));
            document.querySelector('.stat-card:nth-child(2) .value').textContent = orders.length;
            document.querySelector('.stat-card:nth-child(3) .value').textContent = allProducts.length;
            document.querySelector('.stat-card:nth-child(4) .value').textContent = "1";
        } catch (e) {
            console.error(e);
        }
    },

    initCharts() {
        // Only init if Chart exists
        if (typeof Chart === 'undefined') {
            setTimeout(() => this.initCharts(), 500);
            return;
        }

        // Common chart options
        Chart.defaults.font.family = "'Inter', sans-serif";
        Chart.defaults.color = '#64748b';

        // Destroy previous charts to avoid reuse of canvas errors
        if (activeCharts.revenue) activeCharts.revenue.destroy();
        if (activeCharts.status) activeCharts.status.destroy();
        if (activeCharts.category) activeCharts.category.destroy();
        if (activeCharts.trend) activeCharts.trend.destroy();

        // 1. Revenue Overview (Line)
        activeCharts.revenue = new Chart(document.getElementById('revenueChart'), {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                datasets: [{
                    label: 'Revenue',
                    data: [42000, 48000, 51000, 55000, 62000, 58000, 71000, 68000, 74000, 82000, 79000, 91000],
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#2563eb'
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { borderDash: [2, 4] } }, x: { grid: { display: false } } } }
        });

        // 2. Order Status (Doughnut)
        activeCharts.status = new Chart(document.getElementById('orderStatusChart'), {
            type: 'doughnut',
            data: {
                labels: ['Delivered', 'Processing', 'Pending', 'Cancelled'],
                datasets: [{
                    data: [65, 20, 10, 5],
                    backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'],
                    borderWidth: 0,
                    cutout: '70%'
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
        });

        // 3. Sales by Category (Bar)
        activeCharts.category = new Chart(document.getElementById('categoryChart'), {
            type: 'bar',
            data: {
                labels: ['Laptops', 'Phones', 'Tablets', 'Accessories', 'Monitors'],
                datasets: [{
                    label: 'Sales',
                    data: [320, 480, 210, 650, 180],
                    backgroundColor: ['#1e3a8a', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd'],
                    borderRadius: 4
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { borderDash: [2, 4] } }, x: { grid: { display: false } } } }
        });

        // 4. Monthly Trend (Line double)
        activeCharts.trend = new Chart(document.getElementById('trendChart'), {
            type: 'line',
            data: {
                labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
                datasets: [
                    { label: 'This Month', data: [12000, 19000, 15000, 22000], borderColor: '#2563eb', tension: 0.4 },
                    { label: 'Last Month', data: [10000, 14000, 12000, 18000], borderColor: '#cbd5e1', borderDash: [5, 5], tension: 0.4 }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', align: 'end' } }, scales: { y: { beginAtZero: true, grid: { display: false } }, x: { grid: { display: false } } } }
        });
    },

    showAdminSubView(subViewId, skipPush = false) {
        this.activeAdminSubView = subViewId;

        // Clean HTML5 PushState routing for Admin SubViews
        if (!skipPush) {
            const basePath = window.location.pathname.split('#')[0];
            const baseDir = basePath.substring(0, basePath.indexOf('/admin') !== -1 ? basePath.indexOf('/admin') : basePath.lastIndexOf('/') + 1) || '/techmart-web/';
            const targetPath = (baseDir.endsWith('/') ? baseDir : baseDir + '/') + 'admin/' + subViewId;
            try {
                if (window.location.pathname !== targetPath || window.location.hash) {
                    history.pushState({ viewId: 'admin', subViewId }, '', targetPath);
                }
            } catch (e) {
                // Fallback
            }
        }

        const titles = {
            'dashboard': 'Dashboard',
            'products': 'Manage Products',
            'categories': 'Manage Categories',
            'orders': 'Manage Orders',
            'inventory': 'Inventory Stock',
            'users': 'Manage Users',
            'payments': 'Payments',
            'contacts': 'Customer Messages',
            'performance': 'System Performance'
        };
        const titleEl = document.getElementById('admin-header-title');
        if (titleEl) titleEl.textContent = titles[subViewId] || 'Admin Portal';

        document.querySelectorAll('.admin-subview-panel').forEach(panel => {
            panel.style.display = 'none';
        });
        const activePanel = document.getElementById(`admin-subview-${subViewId}`);
        if (activePanel) activePanel.style.display = 'block';

        document.querySelectorAll('.admin-menu li').forEach(li => {
            li.classList.remove('active');
        });
        const activeLi = document.getElementById(`admin-menu-${subViewId}`);
        if (activeLi) activeLi.classList.add('active');

        // Reset any search inputs
        const searchInput = document.querySelector('.search-bar input');
        if (searchInput) searchInput.value = '';

        // Stop telemetry updates when leaving performance view
        if (performanceInterval) {
            clearInterval(performanceInterval);
            performanceInterval = null;
        }

        if (subViewId === 'dashboard') {
            this.loadAdminData();
            this.initCharts();
        } else if (subViewId === 'products') {
            this.loadAdminProducts();
        } else if (subViewId === 'categories') {
            this.loadAdminCategories();
        } else if (subViewId === 'orders') {
            this.loadAdminOrdersTab();
        } else if (subViewId === 'inventory') {
            this.loadAdminInventory();
        } else if (subViewId === 'users') {
            this.loadAdminUsers();
        } else if (subViewId === 'payments') {
            this.loadAdminPayments();
        } else if (subViewId === 'contacts') {
            this.loadAdminContacts();
        } else if (subViewId === 'performance') {
            this.initPerformanceMetrics();
        }
    },

    handleAdminSearch(event) {
        const query = event.target.value.toLowerCase().trim();
        const tab = this.activeAdminSubView;

        if (tab === 'products') {
            const rows = document.querySelectorAll('#admin-products-table-body tr');
            rows.forEach(row => {
                const name = row.cells[1].textContent.toLowerCase();
                const sku = row.cells[2].textContent.toLowerCase();
                const cat = row.cells[4].textContent.toLowerCase();
                row.style.display = (name.includes(query) || sku.includes(query) || cat.includes(query)) ? '' : 'none';
            });
        } else if (tab === 'orders') {
            const rows = document.querySelectorAll('#admin-manage-orders-table-body tr');
            rows.forEach(row => {
                const id = row.cells[0].textContent.toLowerCase();
                const customer = row.cells[1].textContent.toLowerCase();
                row.style.display = (id.includes(query) || customer.includes(query)) ? '' : 'none';
            });
        } else if (tab === 'inventory') {
            const rows = document.querySelectorAll('#admin-inventory-table-body tr');
            rows.forEach(row => {
                const id = row.cells[0].textContent.toLowerCase();
                const name = row.cells[1].textContent.toLowerCase();
                const sku = row.cells[2].textContent.toLowerCase();
                row.style.display = (id.includes(query) || name.includes(query) || sku.includes(query)) ? '' : 'none';
            });
        } else if (tab === 'users') {
            const rows = document.querySelectorAll('#admin-users-table-body tr');
            rows.forEach(row => {
                const username = row.cells[1].textContent.toLowerCase();
                const email = row.cells[2].textContent.toLowerCase();
                row.style.display = (username.includes(query) || email.includes(query)) ? '' : 'none';
            });
        } else if (tab === 'payments') {
            const rows = document.querySelectorAll('#admin-payments-table-body tr');
            rows.forEach(row => {
                const orderId = row.cells[1].textContent.toLowerCase();
                const customer = row.cells[2].textContent.toLowerCase();
                row.style.display = (orderId.includes(query) || customer.includes(query)) ? '' : 'none';
            });
        } else if (tab === 'contacts') {
            const rows = document.querySelectorAll('#admin-contacts-table-body tr');
            rows.forEach(row => {
                const name = row.cells[1].textContent.toLowerCase();
                const email = row.cells[2].textContent.toLowerCase();
                const msg = row.cells[3].textContent.toLowerCase();
                row.style.display = (name.includes(query) || email.includes(query) || msg.includes(query)) ? '' : 'none';
            });
        }
    },

    async loadCategories() {
        try {
            const res = await fetch(`${API_BASE}/admin/categories`);
            allCategories = await res.json();
            this.populateCategorySelects();
        } catch (e) {
            console.error('Failed to load categories:', e);
        }
    },

    populateCategorySelects() {
        // 1. Storefront Filter Dropdown
        const filterSelect = document.getElementById('product-category-filter');
        if (filterSelect) {
            filterSelect.innerHTML = '<option value="All">All Categories</option>';
            allCategories.forEach(c => {
                filterSelect.innerHTML += `<option value="${c.name}">${c.name}</option>`;
            });
        }

        // 2. Admin Product Form Dropdown
        const adminProductSelect = document.getElementById('admin-product-category');
        if (adminProductSelect) {
            adminProductSelect.innerHTML = '';
            allCategories.forEach(c => {
                adminProductSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`;
            });
        }
    },

    async loadAdminCategories() {
        try {
            await this.loadCategories();
            const tbody = document.getElementById('admin-categories-table-body');
            tbody.innerHTML = '';

            allCategories.forEach(c => {
                tbody.innerHTML += `
                    <tr>
                        <td style="font-weight:600;">${c.id}</td>
                        <td style="font-weight:500;">${c.name}</td>
                        <td>${c.description || 'No description'}</td>
                        <td>
                            <button class="btn btn-outline" style="padding:0.3rem 0.6rem; font-size:0.8rem; margin-right:5px;" onclick="app.openAdminCategoryModal(${c.id})">Edit</button>
                            <button class="btn btn-outline-danger" style="padding:0.3rem 0.6rem; font-size:0.8rem;" onclick="app.deleteAdminCategory(${c.id})">Delete</button>
                        </td>
                    </tr>
                `;
            });
        } catch (e) {
            console.error(e);
        }
    },

    openAdminCategoryModal(categoryId = null) {
        document.getElementById('admin-category-modal').style.display = 'flex';
        const titleEl = document.getElementById('admin-category-modal-title');

        if (categoryId) {
            titleEl.textContent = 'Edit Category';
            const category = allCategories.find(c => c.id === categoryId);
            if (category) {
                document.getElementById('admin-category-id').value = category.id;
                document.getElementById('admin-category-name').value = category.name;
                document.getElementById('admin-category-desc').value = category.description || '';
            }
        } else {
            titleEl.textContent = 'Add New Category';
            document.getElementById('admin-category-id').value = '';
            document.getElementById('admin-category-name').value = '';
            document.getElementById('admin-category-desc').value = '';
        }
    },

    closeAdminCategoryModal() {
        document.getElementById('admin-category-modal').style.display = 'none';
    },

    async handleSaveCategory(event) {
        event.preventDefault();
        const id = document.getElementById('admin-category-id').value;
        const name = document.getElementById('admin-category-name').value.trim();
        const description = document.getElementById('admin-category-desc').value.trim();

        const payload = { name, description };
        const method = id ? 'PUT' : 'POST';
        const url = id ? `${API_BASE}/admin/categories/${id}` : `${API_BASE}/admin/categories`;

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                this.showToast(id ? 'Category Updated!' : 'Category Created!');
                this.closeAdminCategoryModal();
                await this.loadCategories();
                this.loadAdminCategories();
            } else {
                alert('Error saving category.');
            }
        } catch (e) {
            console.error(e);
        }
    },

    async deleteAdminCategory(categoryId) {
        if (!confirm('Are you sure you want to delete this category? Products referencing this category will become uncategorized.')) return;
        try {
            const res = await fetch(`${API_BASE}/admin/categories/${categoryId}`, { method: 'DELETE' });
            if (res.ok) {
                this.showToast('Category Deleted!');
                await this.loadCategories();
                this.loadAdminCategories();
            } else {
                alert('Failed to delete category.');
            }
        } catch (e) {
            console.error(e);
        }
    },

    async loadAdminProducts() {
        try {
            const res = await fetch(`${API_BASE}/products`);
            const products = await res.json();
            const tbody = document.getElementById('admin-products-table-body');
            tbody.innerHTML = '';
            
            products.forEach(p => {
                tbody.innerHTML += `
                    <tr>
                        <td style="font-weight:600;">${p.id}</td>
                        <td style="font-weight:500;">${p.name}</td>
                        <td><code>${p.sku}</code></td>
                        <td style="font-weight:600;">${this.formatCurrency(p.price)}</td>
                        <td>${p.category ? p.category.name : 'Uncategorized'}</td>
                        <td>
                            <button class="btn btn-outline" style="padding:0.3rem 0.6rem; font-size:0.8rem; margin-right:5px;" onclick="app.openAdminProductModal(${p.id})">Edit</button>
                            <button class="btn btn-outline-danger" style="padding:0.3rem 0.6rem; font-size:0.8rem;" onclick="app.deleteAdminProduct(${p.id})">Delete</button>
                        </td>
                    </tr>
                `;
            });
        } catch (e) {
            console.error(e);
        }
    },

    openAdminProductModal(productId = null) {
        document.getElementById('admin-product-modal').style.display = 'flex';
        const titleEl = document.getElementById('admin-product-modal-title');
        
        if (productId) {
            titleEl.textContent = 'Edit Product';
            const product = allProducts.find(p => p.id === productId);
            if (product) {
                document.getElementById('admin-product-id').value = product.id;
                document.getElementById('admin-product-name').value = product.name;
                document.getElementById('admin-product-sku').value = product.sku;
                document.getElementById('admin-product-price').value = product.price;
                document.getElementById('admin-product-category').value = product.category ? product.category.id : '1';
                document.getElementById('admin-product-desc').value = product.description || '';
                document.getElementById('admin-product-image-url').value = product.imageUrl || '';
                const preview = document.getElementById('admin-product-image-preview');
                if (product.imageUrl) {
                    preview.innerHTML = `<img src="${product.imageUrl}" style="width:100%;height:100%;object-fit:cover;">`;
                } else {
                    preview.innerHTML = `<span class="material-icons" style="font-size: 1.5rem; color: var(--text-muted);">image</span>`;
                }
            }
        } else {
            titleEl.textContent = 'Add New Product';
            document.getElementById('admin-product-id').value = '';
            document.getElementById('admin-product-name').value = '';
            document.getElementById('admin-product-sku').value = '';
            document.getElementById('admin-product-price').value = '';
            document.getElementById('admin-product-category').value = '1';
            document.getElementById('admin-product-desc').value = '';
            document.getElementById('admin-product-image-url').value = '';
            document.getElementById('admin-product-image-file').value = '';
            document.getElementById('admin-product-image-preview').innerHTML = `<span class="material-icons" style="font-size: 1.5rem; color: var(--text-muted);">image</span>`;
        }
    },

    closeAdminProductModal() {
        document.getElementById('admin-product-modal').style.display = 'none';
    },

    handleProductImageSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const base64Str = e.target.result;
            document.getElementById('admin-product-image-url').value = base64Str;
            const preview = document.getElementById('admin-product-image-preview');
            preview.innerHTML = `<img src="${base64Str}" style="width:100%;height:100%;object-fit:cover;">`;
        };
        reader.readAsDataURL(file);
    },

    async handleSaveProduct(event) {
        event.preventDefault();
        const id = document.getElementById('admin-product-id').value;
        const name = document.getElementById('admin-product-name').value.trim();
        const sku = document.getElementById('admin-product-sku').value.trim();
        const price = parseFloat(document.getElementById('admin-product-price').value);
        const categoryId = parseInt(document.getElementById('admin-product-category').value);
        const description = document.getElementById('admin-product-desc').value.trim();
        const imageUrl = document.getElementById('admin-product-image-url').value;
 
        const payload = {
            name,
            sku,
            price,
            category: { id: categoryId },
            description,
            imageUrl
        };

        const method = id ? 'PUT' : 'POST';
        const url = id ? `${API_BASE}/admin/products/${id}` : `${API_BASE}/admin/products`;

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                this.showToast(id ? 'Product Updated!' : 'Product Created!');
                this.closeAdminProductModal();
                this.currentPage = 1;
                await this.loadProducts(); // reload storefront products list
                this.loadAdminProducts(); // reload admin products list
            } else {
                alert('Error saving product.');
            }
        } catch (e) {
            console.error(e);
        }
    },

    async deleteAdminProduct(productId) {
        if (!confirm('Are you sure you want to delete this product? This will also remove its inventory data.')) return;
        try {
            const res = await fetch(`${API_BASE}/admin/products/${productId}`, { method: 'DELETE' });
            if (res.ok) {
                this.showToast('Product Deleted!');
                await this.loadProducts();
                this.loadAdminProducts();
            } else {
                alert('Failed to delete product.');
            }
        } catch (e) {
            console.error(e);
        }
    },

    async loadAdminOrdersTab() {
        try {
            const res = await fetch(`${API_BASE}/admin/orders`);
            const orders = await res.json();
            const tbody = document.getElementById('admin-manage-orders-table-body');
            tbody.innerHTML = '';

            orders.forEach(o => {
                tbody.innerHTML += `
                    <tr>
                        <td style="font-weight:600; color:var(--primary);">#TM-2026-${1000 + o.id}</td>
                        <td>
                            <strong>User ${o.user.id}</strong><br>
                            <span class="text-muted" style="font-size:0.8rem;">${o.user.email}</span>
                        </td>
                        <td>${new Date(o.orderDate).toLocaleString()}</td>
                        <td style="font-weight:600;">${this.formatCurrency(o.totalAmount)}</td>
                        <td>
                            <select class="form-select" style="padding: 0.25rem 0.5rem; font-size: 0.85rem;" onchange="app.changeOrderStatus(${o.id}, this.value)">
                                <option value="PENDING" ${o.status === 'PENDING' ? 'selected' : ''}>Pending</option>
                                <option value="PROCESSING" ${o.status === 'PROCESSING' ? 'selected' : ''}>Processing</option>
                                <option value="COMPLETED" ${o.status === 'COMPLETED' ? 'selected' : ''}>Delivered</option>
                                <option value="CANCELLED" ${o.status === 'CANCELLED' ? 'selected' : ''}>Cancelled</option>
                            </select>
                        </td>
                        <td>
                            <button class="btn btn-outline" style="padding:0.3rem 0.6rem; font-size:0.8rem;" onclick="alert('Shipping Address: ${o.shippingAddress.replace(/'/g, "\\'")}')">View Address</button>
                        </td>
                    </tr>
                `;
            });
        } catch (e) {
            console.error(e);
        }
    },

    async changeOrderStatus(orderId, newStatus) {
        try {
            const res = await fetch(`${API_BASE}/admin/orders/${orderId}/status?status=${newStatus}`, { method: 'PUT' });
            if (res.ok) {
                this.showToast('Order Status Updated!');
            } else {
                alert('Failed to update status.');
            }
        } catch (e) {
            console.error(e);
        }
    },

    async loadAdminInventory() {
        try {
            const res = await fetch(`${API_BASE}/admin/inventory`);
            const inventory = await res.json();
            const tbody = document.getElementById('admin-inventory-table-body');
            tbody.innerHTML = '';

            inventory.forEach(inv => {
                tbody.innerHTML += `
                    <tr>
                        <td style="font-weight:600;">${inv.product.id}</td>
                        <td style="font-weight:500;">${inv.product.name}</td>
                        <td><code>${inv.product.sku}</code></td>
                        <td>
                            <input type="number" class="form-input" id="inv-qty-${inv.id}" value="${inv.quantity}" style="width: 80px; padding: 0.25rem 0.5rem; text-align: center;">
                        </td>
                        <td class="text-muted" style="font-size:0.85rem;">${new Date(inv.lastUpdated).toLocaleString()}</td>
                        <td>
                            <button class="btn btn-primary" style="padding:0.3rem 0.6rem; font-size:0.8rem;" onclick="app.updateStockQuantity(${inv.id})">Update Stock</button>
                        </td>
                    </tr>
                `;
            });
        } catch (e) {
            console.error(e);
        }
    },

    async updateStockQuantity(invId) {
        const qty = parseInt(document.getElementById(`inv-qty-${invId}`).value);
        if (isNaN(qty) || qty < 0) {
            alert('Please enter a valid stock quantity.');
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/admin/inventory/${invId}?quantity=${qty}`, { method: 'PUT' });
            if (res.ok) {
                this.showToast('Stock level updated!');
                this.loadAdminInventory();
            } else {
                alert('Failed to update inventory.');
            }
        } catch (e) {
            console.error(e);
        }
    },

    async loadAdminUsers() {
        try {
            const res = await fetch(`${API_BASE}/admin/users`);
            const users = await res.json();
            const tbody = document.getElementById('admin-users-table-body');
            tbody.innerHTML = '';

            users.forEach(u => {
                tbody.innerHTML += `
                    <tr>
                        <td style="font-weight:600;">${u.id}</td>
                        <td><strong>${u.username}</strong></td>
                        <td>${u.email}</td>
                        <td>
                            <select class="form-select" style="padding: 0.25rem 0.5rem; font-size: 0.85rem;" onchange="app.changeUserRole(${u.id}, this.value)">
                                <option value="CUSTOMER" ${u.role === 'CUSTOMER' ? 'selected' : ''}>Customer</option>
                                <option value="ADMIN" ${u.role === 'ADMIN' ? 'selected' : ''}>Admin</option>
                            </select>
                        </td>
                        <td>
                            <button class="btn btn-outline" style="padding:0.3rem 0.6rem; font-size:0.8rem;" onclick="alert('Full Name: ${u.fullName || 'N/A'}\\nPhone: ${u.phone || 'N/A'}\\nAddress: ${u.street || 'N/A'}, ${u.city || 'N/A'}')">More Info</button>
                            <button class="btn btn-outline" style="padding:0.3rem 0.6rem; font-size:0.8rem; margin-left: 5px;" onclick="app.showUserOrders(${u.id}, '${u.username}')">View Orders</button>
                        </td>
                    </tr>
                `;
            });
        } catch (e) {
            console.error(e);
        }
    },

    async changeUserRole(userId, newRole) {
        try {
            const res = await fetch(`${API_BASE}/admin/users/${userId}/role?role=${newRole}`, { method: 'PUT' });
            if (res.ok) {
                this.showToast('User Role Updated!');
            } else {
                alert('Failed to update role.');
            }
        } catch (e) {
            console.error(e);
        }
    },

    async showUserOrders(userId, username) {
        try {
            const res = await fetch(`${API_BASE}/admin/orders`);
            const orders = await res.json();
            const filteredOrders = orders.filter(o => o.user && o.user.id === userId);

            document.getElementById('admin-user-orders-title').textContent = `Orders for ${username} (ID: ${userId})`;
            const tbody = document.getElementById('admin-user-orders-body');
            tbody.innerHTML = '';

            if (filteredOrders.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No orders found for this user.</td></tr>`;
            } else {
                filteredOrders.forEach(o => {
                    let statusBadge = '';
                    if (o.status === 'PENDING') statusBadge = '<span class="badge" style="background:#fef3c7; color:#d97706; padding:0.4rem 0.8rem;">Pending</span>';
                    if (o.status === 'COMPLETED') statusBadge = '<span class="badge" style="background:#d1fae5; color:#059669; padding:0.4rem 0.8rem;">Delivered</span>';
                    if (o.status === 'PROCESSING') statusBadge = '<span class="badge" style="background:#dbeafe; color:#2563eb; padding:0.4rem 0.8rem;">Processing</span>';
                    if (o.status === 'CANCELLED') statusBadge = '<span class="badge" style="background:#fee2e2; color:#dc2626; padding:0.4rem 0.8rem;">Cancelled</span>';

                    tbody.innerHTML += `
                        <tr>
                            <td style="font-weight:600; color:var(--primary);">#TM-2026-${1000 + o.id}</td>
                            <td>${new Date(o.orderDate).toLocaleString()}</td>
                            <td>${o.shippingAddress}</td>
                            <td style="font-weight:600;">${this.formatCurrency(o.totalAmount)}</td>
                            <td>${statusBadge}</td>
                        </tr>
                    `;
                });
            }

            document.getElementById('admin-user-orders-modal').style.display = 'flex';
        } catch (e) {
            console.error(e);
        }
    },

    closeUserOrdersModal() {
        document.getElementById('admin-user-orders-modal').style.display = 'none';
    },

    async loadAdminPayments() {
        try {
            const res = await fetch(`${API_BASE}/admin/orders`);
            const orders = await res.json();
            
            const successBody = document.getElementById('admin-payments-success-body');
            const failedBody = document.getElementById('admin-payments-failed-body');
            
            successBody.innerHTML = '';
            failedBody.innerHTML = '';

            orders.forEach(o => {
                const isSuccess = o.status === 'PAID' || o.status === 'COMPLETED';
                const statusBadgeStyle = isSuccess 
                    ? 'background:#d1fae5; color:#059669; padding:0.3rem 0.6rem;'
                    : o.status === 'PENDING'
                        ? 'background:#fef3c7; color:#d97706; padding:0.3rem 0.6rem;'
                        : o.status === 'PROCESSING'
                            ? 'background:#dbeafe; color:#2563eb; padding:0.3rem 0.6rem;'
                            : 'background:#fee2e2; color:#dc2626; padding:0.3rem 0.6rem;';
                
                const rowHtml = `
                    <tr>
                        <td style="font-weight:600; color:var(--primary);">#TM-2026-${1000 + o.id}</td>
                        <td>${o.user ? o.user.email : 'N/A'}</td>
                        <td>${o.shippingAddress}</td>
                        <td style="font-weight:600;">${this.formatCurrency(o.totalAmount)}</td>
                        <td>
                            <span class="badge" style="${statusBadgeStyle}">${o.status}</span>
                        </td>
                        <td class="text-muted" style="font-size:0.85rem;">${new Date(o.orderDate).toLocaleDateString()}</td>
                    </tr>
                `;
                
                if (isSuccess) {
                    successBody.innerHTML += rowHtml;
                } else {
                    failedBody.innerHTML += rowHtml;
                }
            });
            
            if (successBody.innerHTML === '') {
                successBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">No successful payments found.</td></tr>`;
            }
            if (failedBody.innerHTML === '') {
                failedBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">No unsuccessful or pending payments found.</td></tr>`;
            }
        } catch (e) {
            console.error(e);
        }
    },

    async loadAdminContacts() {
        try {
            const res = await fetch(`${API_BASE}/admin/contacts`);
            const contacts = await res.json();
            const tbody = document.getElementById('admin-contacts-table-body');
            tbody.innerHTML = '';

            contacts.forEach(c => {
                const actionHtml = (c.reply 
                    ? `<span style="color:var(--success); font-weight:600; display:inline-flex; align-items:center; gap:4px; margin-right:10px;"><span class="material-icons" style="font-size:16px;">check_circle</span> Replied</span>`
                    : `<button class="btn btn-primary" style="padding:0.3rem 0.6rem; font-size:0.8rem; margin-right:10px;" onclick="app.openAdminContactReplyModal(${c.id}, '${c.message.replace(/'/g, "\\'")}')">Reply</button>`)
                    + `<button class="btn btn-outline-danger" style="padding:0.3rem 0.6rem; font-size:0.8rem;" onclick="app.deleteAdminContact(${c.id})"><span class="material-icons" style="font-size:14px; vertical-align:middle;">delete</span></button>`;
                tbody.innerHTML += `
                    <tr>
                        <td style="font-weight:600;">${c.id}</td>
                        <td><strong>${c.name}</strong></td>
                        <td><a href="mailto:${c.email}">${c.email}</a></td>
                        <td>${c.message}</td>
                        <td class="text-muted" style="font-size:0.85rem;">${new Date(c.submittedAt).toLocaleString()}</td>
                        <td>${actionHtml}</td>
                    </tr>
                `;
            });
        } catch (e) {
            console.error(e);
        }
    },

    initPerformanceMetrics() {
        this.updateMetricsDashboard();

        if (performanceInterval) clearInterval(performanceInterval);
        performanceInterval = setInterval(() => {
            this.updateMetricsDashboard();
        }, 4000);
    },

    async updateMetricsDashboard() {
        const categorySelect = document.getElementById('perf-category-select');
        const concurrencySelect = document.getElementById('perf-concurrency-select');

        const selectedCategory = categorySelect ? categorySelect.value : 'ALL';
        const simulatedUsers = concurrencySelect ? parseInt(concurrencySelect.value) : 1;

        let catalogLoadTimeMs = 24.5;
        let dbQueryTimeMs = 3.8;
        let imageAssetFetchTimeMs = 32.1;
        let usedMemoryMb = 182;
        let totalMemoryMb = 512;

        try {
            const res = await fetch(`${API_BASE}/admin/metrics?category=${encodeURIComponent(selectedCategory)}&simulatedUsers=${simulatedUsers}`);
            if (res.ok) {
                const data = await res.json();
                catalogLoadTimeMs = data.catalogLoadTimeMs || 24.5;
                dbQueryTimeMs = data.dbQueryTimeMs || 3.8;
                imageAssetFetchTimeMs = data.imageAssetFetchTimeMs || 32.1;
                usedMemoryMb = data.usedMemoryMb || 182;
                totalMemoryMb = data.totalMemoryMb || 512;
            }
        } catch (e) {
            console.warn('Fallback telemetry values used:', e);
        }

        // Update Stat Cards UI
        const catalogLoadEl = document.getElementById('perf-catalog-load');
        const dbQueryEl = document.getElementById('perf-db-query');
        const imgFetchEl = document.getElementById('perf-image-fetch');
        const ramEl = document.getElementById('perf-ram');
        const ramTotalEl = document.getElementById('perf-ram-total');
        const catalogStatusEl = document.getElementById('perf-catalog-status');

        if (catalogLoadEl) catalogLoadEl.textContent = `${catalogLoadTimeMs.toFixed(1)} ms`;
        if (dbQueryEl) dbQueryEl.textContent = `${dbQueryTimeMs.toFixed(1)} ms`;
        if (imgFetchEl) imgFetchEl.textContent = `${imageAssetFetchTimeMs.toFixed(1)} ms`;
        if (ramEl) ramEl.textContent = `${usedMemoryMb} MB`;
        if (ramTotalEl) ramTotalEl.textContent = `of ${totalMemoryMb} MB Total`;

        if (catalogStatusEl) {
            if (catalogLoadTimeMs < 50) {
                catalogStatusEl.innerHTML = `<span class="badge" style="background:#d1fae5; color:#059669; padding:0.2rem 0.5rem; font-size:0.75rem;">Optimal (&lt;50ms)</span>`;
            } else if (catalogLoadTimeMs < 120) {
                catalogStatusEl.innerHTML = `<span class="badge" style="background:#fef3c7; color:#d97706; padding:0.2rem 0.5rem; font-size:0.75rem;">Normal (&lt;120ms)</span>`;
            } else {
                catalogStatusEl.innerHTML = `<span class="badge" style="background:#fee2e2; color:#dc2626; padding:0.2rem 0.5rem; font-size:0.75rem;">High Load (&gt;120ms)</span>`;
            }
        }

        // Update Metrics Log Table
        const tableCatalog = document.getElementById('table-catalog-latency');
        const tableDb = document.getElementById('table-db-latency');
        const tableImg = document.getElementById('table-img-latency');
        if (tableCatalog) tableCatalog.textContent = `${catalogLoadTimeMs.toFixed(1)} ms`;
        if (tableDb) tableDb.textContent = `${dbQueryTimeMs.toFixed(1)} ms`;
        if (tableImg) tableImg.textContent = `${imageAssetFetchTimeMs.toFixed(1)} ms`;

        // Render Charts
        if (typeof Chart === 'undefined') return;

        // 1. Catalog Latency Chart
        const catalogCanvas = document.getElementById('catalogLatencyChart');
        if (catalogCanvas) {
            const ctx1 = catalogCanvas.getContext('2d');
            if (activeCharts.catalogLatency) activeCharts.catalogLatency.destroy();

            activeCharts.catalogLatency = new Chart(ctx1, {
                type: 'bar',
                data: {
                    labels: ['DB Query (JPA)', 'Image Asset Load', 'Total Catalog Render'],
                    datasets: [{
                        label: `Latency (ms) - [Category: ${selectedCategory}, Users: ${simulatedUsers}]`,
                        data: [dbQueryTimeMs, imageAssetFetchTimeMs, catalogLoadTimeMs],
                        backgroundColor: ['rgba(16, 185, 129, 0.7)', 'rgba(139, 92, 246, 0.7)', 'rgba(59, 130, 246, 0.7)'],
                        borderColor: ['#10b981', '#8b5cf6', '#3b82f6'],
                        borderWidth: 1.5,
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: { display: true, text: 'Duration (Milliseconds)' }
                        }
                    }
                }
            });
        }

        // 2. JVM Heap Memory & Response Time Line Chart
        const perfCanvas = document.getElementById('perfChart');
        if (perfCanvas) {
            const ctx2 = perfCanvas.getContext('2d');
            
            if (!this.perfHistory) {
                this.perfHistory = {
                    labels: ['30s ago', '25s ago', '20s ago', '15s ago', '10s ago', '5s ago', 'Just now'],
                    ram: [175, 178, 180, 182, 185, 183, usedMemoryMb],
                    latency: [22, 24, 25, 23, 26, 24, catalogLoadTimeMs]
                };
            } else {
                this.perfHistory.ram.shift();
                this.perfHistory.ram.push(usedMemoryMb);
                this.perfHistory.latency.shift();
                this.perfHistory.latency.push(catalogLoadTimeMs);
            }

            if (activeCharts.perf) activeCharts.perf.destroy();

            activeCharts.perf = new Chart(ctx2, {
                type: 'line',
                data: {
                    labels: this.perfHistory.labels,
                    datasets: [
                        {
                            label: 'Catalog Page Load (ms)',
                            data: this.perfHistory.latency,
                            borderColor: '#3b82f6',
                            backgroundColor: 'rgba(59, 130, 246, 0.08)',
                            tension: 0.3,
                            fill: true,
                            yAxisID: 'y'
                        },
                        {
                            label: 'Used Memory (MB)',
                            data: this.perfHistory.ram,
                            borderColor: '#f59e0b',
                            backgroundColor: 'rgba(245, 158, 11, 0.08)',
                            tension: 0.3,
                            fill: true,
                            yAxisID: 'y1'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            type: 'linear',
                            display: true,
                            position: 'left',
                            title: { display: true, text: 'Catalog Latency (ms)' }
                        },
                        y1: {
                            type: 'linear',
                            display: true,
                            position: 'right',
                            title: { display: true, text: 'Memory (MB)' },
                            grid: { drawOnChartArea: false }
                        }
                    }
                }
            });
        }
    },


    // --- USER PROFILE & DROPDOWN ---
    toggleUserDropdown(event) {
        event.stopPropagation();
        const menu = document.getElementById('user-dropdown-menu');
        if (menu) menu.classList.toggle('show');
    },

    closeUserDropdown() {
        const menu = document.getElementById('user-dropdown-menu');
        if (menu) menu.classList.remove('show');
    },

    setupDropdownListeners() {
        document.addEventListener('click', () => {
            this.closeUserDropdown();
            const dd = document.getElementById('notifications-dropdown');
            if (dd) dd.style.display = 'none';
            const add = document.getElementById('admin-notifications-dropdown');
            if (add) add.style.display = 'none';
        });
    },

    getUserExtra(userId) {
        if (!userId) return {};
        const data = localStorage.getItem(`techmart_user_extra_${userId}`);
        return data ? JSON.parse(data) : {};
    },

    saveUserExtra(userId, extra) {
        if (!userId) return;
        localStorage.setItem(`techmart_user_extra_${userId}`, JSON.stringify(extra));
    },

    triggerProfilePicUpload() {
        const input = document.getElementById('profile-pic-input');
        if (input) input.click();
    },

    handleProfilePicUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const base64Str = e.target.result;
            const extra = this.getUserExtra(CURRENT_USER_ID);
            extra.profilePic = base64Str;
            this.saveUserExtra(CURRENT_USER_ID, extra);

            currentUser.profilePic = base64Str;
            this.showToast('Profile Picture Updated!');
            this.updateHeaderAndProfileUI();
        };
        reader.readAsDataURL(file);
    },

    updateHeaderAndProfileUI() {
        const headerName = document.getElementById('header-user-name');
        const profileDisplayName = document.getElementById('profile-display-name');
        const profileAvatar = document.getElementById('profile-avatar');
        const profileAvatarImg = document.getElementById('profile-avatar-img');
        const headerAvatarSvg = document.getElementById('header-avatar-svg');
        const headerAvatarImg = document.getElementById('header-avatar-img');

        const displayName = currentUser.fullName ? currentUser.fullName.trim().split(' ')[0] : (currentUser.username || 'User');
        if (headerName) headerName.textContent = displayName;
        if (profileDisplayName) profileDisplayName.textContent = currentUser.fullName || currentUser.username || 'User';

        if (profileAvatar && (currentUser.fullName || currentUser.username)) {
            const nameToUse = currentUser.fullName || currentUser.username;
            profileAvatar.textContent = nameToUse.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        }

        if (currentUser.profilePic) {
            if (profileAvatarImg) {
                profileAvatarImg.src = currentUser.profilePic;
                profileAvatarImg.style.display = 'block';
            }
            if (profileAvatar) {
                profileAvatar.style.display = 'none';
            }
            if (headerAvatarImg) {
                headerAvatarImg.src = currentUser.profilePic;
                headerAvatarImg.style.display = 'block';
            }
            if (headerAvatarSvg) {
                headerAvatarSvg.style.display = 'none';
            }
        } else {
            if (profileAvatarImg) {
                profileAvatarImg.style.display = 'none';
            }
            if (profileAvatar) {
                profileAvatar.style.display = 'flex';
            }
            if (headerAvatarImg) {
                headerAvatarImg.style.display = 'none';
            }
            if (headerAvatarSvg) {
                headerAvatarSvg.style.display = 'block';
            }
        }
    },

    clearAllForms() {
        // Reset checkout form fields
        ['checkout-first-name', 'checkout-last-name', 'checkout-email', 'checkout-address', 'checkout-city', 'checkout-state', 'checkout-zip', 'checkout-phone'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        const checkoutCountry = document.getElementById('checkout-country');
        if (checkoutCountry) checkoutCountry.value = 'United States';

        // Reset profile form fields
        ['profile-firstname', 'profile-lastname', 'profile-email', 'profile-phone', 'profile-street', 'profile-city', 'profile-state', 'profile-zip'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        const profileCountry = document.getElementById('profile-country');
        if (profileCountry) profileCountry.value = 'Sri Lanka';

        // Reset password fields
        ['profile-current-pass', 'profile-new-pass', 'profile-confirm-pass'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
    },

    fillProfileForm() {
        const names = (currentUser.fullName || '').trim().split(' ');
        const firstName = names[0] || currentUser.username || '';
        const lastName = names.slice(1).join(' ') || '';

        const fnInput = document.getElementById('profile-firstname');
        if (fnInput) fnInput.value = firstName;

        const lnInput = document.getElementById('profile-lastname');
        if (lnInput) lnInput.value = lastName;

        const emailInput = document.getElementById('profile-email');
        if (emailInput) emailInput.value = currentUser.email || '';

        const phoneInput = document.getElementById('profile-phone');
        if (phoneInput) phoneInput.value = currentUser.phone || '';

        const streetInput = document.getElementById('profile-street');
        if (streetInput) streetInput.value = currentUser.street || '';

        const cityInput = document.getElementById('profile-city');
        if (cityInput) cityInput.value = currentUser.city || '';

        const stateInput = document.getElementById('profile-state');
        if (stateInput) stateInput.value = currentUser.state || '';

        const zipInput = document.getElementById('profile-zip');
        if (zipInput) zipInput.value = currentUser.zip || '';

        const countrySelect = document.getElementById('profile-country');
        if (countrySelect) {
            countrySelect.value = currentUser.country || 'Sri Lanka';
        }
    },

    async loadUserProfile() {
        try {
            const res = await fetch(`${API_BASE}/users/me`);
            if (res.ok) {
                currentUser = await res.json();
                CURRENT_USER_ID = currentUser.id;
                isLoggedIn = true;
                const extra = this.getUserExtra(CURRENT_USER_ID);
                currentUser = { ...currentUser, ...extra };

                const dateStr = currentUser.createdAt
                    ? new Date(currentUser.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
                    : 'June 2026';
                const memberSince = document.getElementById('profile-member-since');
                if (memberSince) memberSince.textContent = dateStr;

                this.updateHeaderAndProfileUI();
                this.fillProfileForm();
            }
        } catch (e) {
            console.error(e);
        }
    },

    async updateUserProfile(event) {
        event.preventDefault();
        const firstName = document.getElementById('profile-firstname').value.trim();
        const lastName = document.getElementById('profile-lastname').value.trim();
        const email = document.getElementById('profile-email').value;
        const phone = document.getElementById('profile-phone').value;
        const street = document.getElementById('profile-street').value;
        const city = document.getElementById('profile-city').value;
        const state = document.getElementById('profile-state').value;
        const zip = document.getElementById('profile-zip').value;
        const country = document.getElementById('profile-country').value;

        const fullName = `${firstName} ${lastName}`;
        const username = email;

        currentUser.username = username;
        currentUser.email = email;
        currentUser.fullName = fullName;
        currentUser.phone = phone;
        currentUser.street = street;
        currentUser.city = city;
        currentUser.state = state;
        currentUser.zip = zip;
        currentUser.country = country;

        const extra = this.getUserExtra(CURRENT_USER_ID);
        extra.username = username;
        extra.email = email;
        extra.fullName = fullName;
        extra.phone = phone;
        extra.street = street;
        extra.city = city;
        extra.state = state;
        extra.zip = zip;
        extra.country = country;
        this.saveUserExtra(CURRENT_USER_ID, extra);

        try {
            const res = await fetch(`${API_BASE}/users/${CURRENT_USER_ID || 1}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, fullName, phone, street, city, state, zip, country })
            });

            if (res.ok) {
                this.showToast('Profile Updated!');
                this.loadUserProfile();
                this.updateAuthHeaderUI();
            } else {
                alert('Failed to update database profile details.');
            }
        } catch (e) {
            console.error(e);
        }
    },

    changePassword(event) {
        event.preventDefault();
        const currentPass = document.getElementById('profile-current-pass').value;
        const newPass = document.getElementById('profile-new-pass').value;
        const confirmPass = document.getElementById('profile-confirm-pass').value;

        if (newPass !== confirmPass) {
            alert('New passwords do not match.');
            return;
        }

        const extra = this.getUserExtra(CURRENT_USER_ID);
        const storedPass = extra.password || 'password123';

        if (currentPass !== storedPass) {
            alert('Incorrect current password.');
            return;
        }

        extra.password = newPass;
        this.saveUserExtra(CURRENT_USER_ID, extra);
        this.showToast('Password Updated Successfully!');
        document.getElementById('profile-password-form').reset();
    },

    prefillCheckoutAddress() {
        if (!isLoggedIn || !currentUser) return;

        const names = (currentUser.fullName || currentUser.username || '').split(' ');
        const firstName = names[0] || '';
        const lastName = names.slice(1).join(' ') || '';

        const fnInput = document.getElementById('checkout-first-name');
        if (fnInput) fnInput.value = firstName;

        const lnInput = document.getElementById('checkout-last-name');
        if (lnInput) lnInput.value = lastName;

        const emailInput = document.getElementById('checkout-email');
        if (emailInput) emailInput.value = currentUser.email || '';

        const streetInput = document.getElementById('checkout-address');
        if (streetInput) streetInput.value = currentUser.street || '';

        const cityInput = document.getElementById('checkout-city');
        if (cityInput) cityInput.value = currentUser.city || '';

        const stateInput = document.getElementById('checkout-state');
        if (stateInput) stateInput.value = currentUser.state || '';

        const zipInput = document.getElementById('checkout-zip');
        if (zipInput) zipInput.value = currentUser.zip || '';

        const countrySelect = document.getElementById('checkout-country');
        if (countrySelect && currentUser.country) {
            countrySelect.value = currentUser.country;
        }

        const phoneInput = document.getElementById('checkout-phone');
        if (phoneInput) phoneInput.value = currentUser.phone || '';
    },

    async renderUserProfileAndOrders() {
        try {
            const res = await fetch(`${API_BASE}/admin/orders`);
            const allOrders = await res.json();
            const targetUserId = Number(CURRENT_USER_ID) === 999 ? 1 : CURRENT_USER_ID;
            const userOrders = allOrders.filter(o => o.user && o.user.id === targetUserId);

            const successBody = document.getElementById('profile-orders-success-body');
            const failedBody = document.getElementById('profile-orders-failed-body');
            
            if (successBody && failedBody) {
                successBody.innerHTML = '';
                failedBody.innerHTML = '';
                
                userOrders.forEach(o => {
                    const isSuccess = o.status === 'PAID' || o.status === 'COMPLETED';
                    const statusBadgeStyle = isSuccess 
                        ? 'background:#d1fae5; color:#059669; padding:0.4rem 0.8rem;'
                        : o.status === 'PENDING'
                            ? 'background:#fef3c7; color:#d97706; padding:0.4rem 0.8rem;'
                            : o.status === 'PROCESSING'
                                ? 'background:#dbeafe; color:#2563eb; padding:0.4rem 0.8rem;'
                                : 'background:#fee2e2; color:#dc2626; padding:0.4rem 0.8rem;';
                    
                    const rowHtml = `
                        <tr>
                            <td style="font-weight:600; color:var(--primary);">#TM-2026-${1000 + o.id}</td>
                            <td>${new Date(o.orderDate).toLocaleDateString()}</td>
                            <td>${o.shippingAddress}</td>
                            <td style="font-weight:600;">${this.formatCurrency(o.totalAmount)}</td>
                            <td><span class="badge" style="${statusBadgeStyle}">${o.status}</span></td>
                        </tr>
                    `;
                    
                    if (isSuccess) {
                        successBody.innerHTML += rowHtml;
                    } else {
                        failedBody.innerHTML += rowHtml;
                    }
                });
                
                if (successBody.innerHTML === '') {
                    successBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No successful orders found.</td></tr>`;
                }
                if (failedBody.innerHTML === '') {
                    failedBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No pending or unsuccessful orders found.</td></tr>`;
                }
            }
            this.loadUserMessagesHistory();
        } catch (e) {
            console.error(e);
        }
    },

    async loadUserMessagesHistory() {
        try {
            const res = await fetch(`${API_BASE}/users/messages`);
            if (res.ok) {
                const messages = await res.json();
                const tbody = document.getElementById('profile-messages-body');
                if (!tbody) return;
                tbody.innerHTML = '';
                if (messages.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">No messages found.</td></tr>';
                    return;
                }
                messages.forEach(m => {
                    const replyVal = m.reply 
                        ? `<div style="color:var(--text-main); font-weight:500;">${m.reply}</div><div class="text-muted" style="font-size:0.75rem; margin-top:0.25rem;">Replied on: ${new Date(m.repliedAt).toLocaleString()}</div>`
                        : `<span class="text-muted" style="font-style:italic;">Pending Admin response</span>`;
                    tbody.innerHTML += `
                        <tr>
                            <td class="text-muted" style="font-size:0.85rem; white-space:nowrap;">${new Date(m.submittedAt).toLocaleString()}</td>
                            <td>${m.message}</td>
                            <td>${replyVal}</td>
                        </tr>
                    `;
                });
            }
        } catch (e) {
            console.error(e);
        }
    },

    // --- WISHLIST ---
    async loadWishlist() {
        if (!isLoggedIn || !CURRENT_USER_ID) {
            wishlistItems = [];
            document.getElementById('wishlist-badge').textContent = '0';
            return;
        }
        try {
            const userIdToPass = Number(CURRENT_USER_ID) === 999 ? 1 : CURRENT_USER_ID;
            const res = await fetch(`${API_BASE}/users/${userIdToPass}/wishlist`);
            if (res.ok) {
                wishlistItems = await res.json();
                document.getElementById('wishlist-badge').textContent = wishlistItems.length;
            }
        } catch (e) {
            console.error(e);
        }
    },

    async toggleWishlist(productId, event) {
        if (event) event.stopPropagation();
        
        if (!isLoggedIn) {
            this.showToast('Please login to use wishlist.');
            this.openAuthModal('signin');
            return;
        }
        
        const isWishlisted = wishlistItems.some(item => item.product.id === productId);
        const userIdToPass = Number(CURRENT_USER_ID) === 999 ? 1 : CURRENT_USER_ID;
        try {
            if (isWishlisted) {
                const res = await fetch(`${API_BASE}/users/${userIdToPass}/wishlist/${productId}`, { method: 'DELETE' });
                if (res.ok) {
                    this.showToast('Removed from Wishlist');
                    await this.loadWishlist();
                    this.renderFeaturedProducts();
                    this.renderProductsGrid();
                    if (document.getElementById('view-wishlist').classList.contains('active')) {
                        this.renderWishlistGrid();
                    }
                }
            } else {
                const res = await fetch(`${API_BASE}/users/${userIdToPass}/wishlist/${productId}`, { method: 'POST' });
                if (res.ok) {
                    this.showToast('Added to Wishlist');
                    await this.loadWishlist();
                    this.renderFeaturedProducts();
                    this.renderProductsGrid();
                }
            }
        } catch (e) {
            console.error(e);
        }
    },

    renderWishlistGrid() {
        const grid = document.getElementById('wishlist-grid');
        if (!grid) return;

        grid.innerHTML = '';
        if (wishlistItems.length === 0) {
            grid.innerHTML = '<div style="grid-column: 1/-1; padding: 3rem 0; text-align: center; color: var(--text-muted); font-size:1.1rem;">Your wishlist is empty.</div>';
            return;
        }

        wishlistItems.forEach(item => {
            const p = item.product;
            const imgHtml = this.getProductImage(p, 'card');
            grid.innerHTML += `
                <div class="product-card">
                    <div class="product-img" onclick="app.showProductDetails(${p.id})" style="cursor:pointer;">${imgHtml}</div>
                    <div class="product-meta">
                        <span class="product-cat">${p.category ? p.category.name : 'Accessories'}</span>
                        <span class="product-stock"><span class="material-icons" style="font-size:12px;vertical-align:middle;margin-right:2px;color:var(--success);">check_circle</span> In Stock</span>
                    </div>
                    <h3 onclick="app.showProductDetails(${p.id})" style="cursor:pointer;">${p.name}</h3>
                    <div class="price">${this.formatCurrency(p.price)}</div>
                    <div class="product-actions">
                        <button class="btn btn-primary" onclick="app.addToCart(${p.id})">Add to Cart</button>
                        <button class="btn btn-outline-danger" onclick="app.toggleWishlist(${p.id})"><span class="material-icons" style="font-size:16px;vertical-align:middle;">delete</span></button>
                    </div>
                </div>
            `;
        });
    },

    // --- GLOBAL SEARCH ---
    handleGlobalSearch(event) {
        const query = event.target.value.toLowerCase().trim();
        this.showView('products');
        
        const grid = document.getElementById('full-product-grid');
        const count = document.getElementById('products-count');
        if (!grid) return;
        
        grid.innerHTML = '';
        
        const filtered = allProducts.filter(p => 
            p.name.toLowerCase().includes(query) || 
            (p.description && p.description.toLowerCase().includes(query)) ||
            (p.category && p.category.name.toLowerCase().includes(query))
        );
        
        count.textContent = `Showing ${filtered.length} products`;
        
        if (filtered.length === 0) {
            grid.innerHTML = '<div style="grid-column: 1/-1; padding: 3rem 0; text-align: center; color: var(--text-muted); font-size:1.1rem;">No products match your search.</div>';
            return;
        }

        filtered.forEach(p => {
            const imgHtml = this.getProductImage(p, 'card');
            const isWishlisted = wishlistItems.some(item => item.product.id === p.id);
            const heartSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;
            grid.innerHTML += `
                <div class="product-card">
                    <div class="product-img" onclick="app.showProductDetails(${p.id})" style="cursor:pointer;">${imgHtml}</div>
                    <div class="product-meta">
                        <span class="product-cat">${p.category ? p.category.name : 'Accessories'}</span>
                        <span class="product-stock"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg> In Stock</span>
                    </div>
                    <h3 onclick="app.showProductDetails(${p.id})" style="cursor:pointer;">${p.name}</h3>
                    <div class="price">${this.formatCurrency(p.price)}</div>
                    <div class="product-actions">
                        <button class="btn btn-outline" onclick="app.showProductDetails(${p.id})">Details</button>
                        <button class="btn btn-wishlist ${isWishlisted ? 'active' : ''}" onclick="app.toggleWishlist(${p.id}, event)">${heartSvg}</button>
                        <button class="btn btn-primary" onclick="app.addToCart(${p.id})"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg></button>
                    </div>
                </div>
            `;
        });
    },

    // --- THEME MANAGEMENT ---
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        this.updateThemeIcon(newTheme);
    },

    updateThemeIcon(theme) {
        const icon = document.getElementById('theme-icon');
        if (!icon) return;
        if (theme === 'dark') {
            icon.outerHTML = `<svg id="theme-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
        } else {
            icon.outerHTML = `<svg id="theme-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
        }
    },

    initTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        this.updateThemeIcon(savedTheme);
    },

    openAuthModal(mode) {
        if (mode === 'signup') {
            window.location.href = 'signup.jsp';
        } else {
            window.location.href = 'signin.jsp';
        }
    },

    closeAuthModal() {
        document.getElementById('auth-modal').style.display = 'none';
    },

    switchAuthView(mode) {
        if (mode === 'signin') {
            document.getElementById('auth-signin-view').style.display = 'block';
            document.getElementById('auth-signup-view').style.display = 'none';
        } else {
            document.getElementById('auth-signin-view').style.display = 'none';
            document.getElementById('auth-signup-view').style.display = 'block';
        }
    },

    selectedColor: 'Titanium Gray',
    selectProductColor(btn, colorName) {
        this.selectedColor = colorName;
        document.querySelectorAll('.color-swatch').forEach(b => {
            b.classList.remove('active');
            b.style.borderColor = 'transparent';
        });
        btn.classList.add('active');
        btn.style.borderColor = 'var(--primary)';
        const label = document.getElementById('selected-color-label');
        if (label) label.textContent = colorName;
    },

    async addToCartWithQty(productId, qty) {
        if (!isLoggedIn) {
            this.showToast('Please login to add items to cart.');
            this.openAuthModal('signin');
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/cart/add?productId=${productId}&quantity=${qty}`, { method: 'POST' });
            if (res.ok) {
                this.showToast(`Added ${qty} item(s) to Cart`);
                this.loadCart();
            }
        } catch (e) {
            console.error(e);
        }
    },

    async buyNow(productId, qty) {
        if (!isLoggedIn) {
            this.showToast('Please login to buy items.');
            this.openAuthModal('signin');
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/cart/add?productId=${productId}&quantity=${qty}`, { method: 'POST' });
            if (res.ok) {
                await this.loadCart();
                this.showView('checkout');
            }
        } catch (e) {
            console.error(e);
        }
    },

    async submitContactForm(event) {
        event.preventDefault();
        const name = document.getElementById('contact-name').value.trim();
        const email = document.getElementById('contact-email').value.trim();
        const message = document.getElementById('contact-message').value.trim();

        try {
            const res = await fetch(`${API_BASE}/users/contact`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, message })
            });

            if (res.ok) {
                this.showToast('Message Sent Successfully via JMS Queue!');
                document.getElementById('contact-name').value = '';
                document.getElementById('contact-email').value = '';
                document.getElementById('contact-message').value = '';
            } else {
                alert('Failed to send contact message.');
            }
        } catch (e) {
            console.error(e);
            alert('Error sending contact message.');
        }
    },

    _old_showProductDetails(productId) {
        const product = allProducts.find(p => p.id === productId);
        if (!product) return;

        // Reset selectors
        this.selectedColor = 'Titanium Gray';
        const label = document.getElementById('selected-color-label');
        if (label) label.textContent = 'Titanium Gray';
        document.querySelectorAll('.color-swatch').forEach((btn, i) => {
            if (i === 0) {
                btn.classList.add('active');
                btn.style.borderColor = 'var(--primary)';
            } else {
                btn.classList.remove('active');
                btn.style.borderColor = 'transparent';
            }
        });
        const qtySelect = document.getElementById('detail-page-qty');
        if (qtySelect) qtySelect.value = '1';

        const imgHtml = this.getProductImage(product, 'card');

        const detailImg = document.getElementById('detail-page-img');
        if (detailImg) detailImg.innerHTML = imgHtml;

        const detailCat = document.getElementById('detail-page-cat');
        if (detailCat) {
            detailCat.textContent = product.category ? product.category.name : 'Accessories';
        }

        const detailName = document.getElementById('detail-page-name');
        if (detailName) detailName.textContent = product.name;

        const detailSku = document.getElementById('detail-page-sku');
        if (detailSku) detailSku.textContent = `SKU: ${product.sku}`;

        const detailDesc = document.getElementById('detail-page-desc');
        if (detailDesc) {
            detailDesc.textContent = product.description || 'No description available for this premium product.';
        }

        const detailPrice = document.getElementById('detail-page-price');
        if (detailPrice) detailPrice.textContent = this.formatCurrency(product.price);

        const buyBtn = document.getElementById('detail-page-buy-btn');
        if (buyBtn) {
            buyBtn.onclick = () => {
                const qty = parseInt(document.getElementById('detail-page-qty').value) || 1;
                this.buyNow(product.id, qty);
            };
        }

        const cartBtn = document.getElementById('detail-page-cart-btn');
        if (cartBtn) {
            cartBtn.onclick = () => {
                const qty = parseInt(document.getElementById('detail-page-qty').value) || 1;
                this.addToCartWithQty(product.id, qty);
            };
        }

        const wishlistBtn = document.getElementById('detail-page-wishlist-btn');
        if (wishlistBtn) {
            const isWishlisted = wishlistItems.some(item => item.product.id === product.id);
            if (isWishlisted) {
                wishlistBtn.classList.add('active');
            } else {
                wishlistBtn.classList.remove('active');
            }
            wishlistBtn.onclick = (e) => {
                this.toggleWishlist(product.id, e);
                wishlistBtn.classList.toggle('active');
            };
        }

        const relatedGrid = document.getElementById('related-products-grid');
        if (relatedGrid) {
            relatedGrid.innerHTML = '';
            // Get up to 4 other products from the same category
            const relatedProducts = allProducts.filter(p => p.id !== product.id && p.category && product.category && p.category.name === product.category.name).slice(0, 4);
            
            if (relatedProducts.length === 0) {
                relatedGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); font-size:1.1rem;">No related products found.</div>';
            } else {
                relatedProducts.forEach(p => {
                    const imgHtml = this.getProductImage(p, 'card');
                    const isWishlisted = wishlistItems.some(item => item.product.id === p.id);
                    const heartSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;
                    relatedGrid.innerHTML += `
                        <div class="product-card">
                            <div class="product-img" onclick="app.showProductDetails(${p.id})" style="cursor:pointer;">${imgHtml}</div>
                            <div class="product-meta">
                                <span class="product-cat">${p.category ? p.category.name : 'Accessories'}</span>
                                <span class="product-stock"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg> In Stock</span>
                            </div>
                            <h3 onclick="app.showProductDetails(${p.id})" style="cursor:pointer;">${p.name}</h3>
                            <div class="price">${this.formatCurrency(p.price)}</div>
                            <div class="product-actions">
                                <button class="btn btn-outline" onclick="app.showProductDetails(${p.id}); window.scrollTo(0,0);">View Details</button>
                                <button class="btn btn-wishlist ${isWishlisted ? 'active' : ''}" onclick="app.toggleWishlist(${p.id}, event)">${heartSvg}</button>
                                <button class="btn btn-primary" onclick="app.addToCart(${p.id})"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg></button>
                            </div>
                        </div>
                    `;
                });
            }
        }

        this.showView('product-details');
    },

    async handleAdminLogin(event) {
        event.preventDefault();
        const username = document.getElementById('admin-login-username').value.trim();
        const password = document.getElementById('admin-login-password').value;

        try {
            const res = await fetch(`${API_BASE}/admin/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (res.ok) {
                currentAdminUser = await res.json();
                isAdminLoggedIn = true;
                this.showToast('Welcome Administrator!');
                this.showView('admin');
            } else {
                const err = await res.json().catch(() => ({}));
                alert(err.error || 'Invalid admin credentials.');
            }
        } catch (e) {
            console.error(e);
            alert('Admin authentication failed.');
        }
    },

    async handleSignIn(event) {
        event.preventDefault();
        const username = document.getElementById('signin-username').value.trim();
        const password = document.getElementById('signin-password').value;

        try {
            const res = await fetch(`${API_BASE}/users/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (res.ok) {
                currentUser = await res.json();
                CURRENT_USER_ID = currentUser.id;
                isLoggedIn = true;

                const extra = this.getUserExtra(CURRENT_USER_ID);
                if (!extra.password) {
                    extra.password = password;
                    this.saveUserExtra(CURRENT_USER_ID, extra);
                }

                this.showToast(`Welcome back, ${currentUser.username}!`);
                this.closeAuthModal();
                this.updateAuthHeaderUI();
                await this.loadWishlist();
                this.showView('home');
            } else {
                const err = await res.json();
                alert(err.error || 'Invalid login details.');
            }
        } catch (e) {
            console.error(e);
            alert('Error during login.');
        }
    },

    async handleSignUp(event) {
        event.preventDefault();
        const firstName = document.getElementById('signup-firstname').value.trim();
        const lastName = document.getElementById('signup-lastname').value.trim();
        const email = document.getElementById('signup-email').value.trim();
        const mobile = document.getElementById('signup-mobile').value.trim();
        const password = document.getElementById('signup-password').value;
        const confirmPassword = document.getElementById('signup-confirm-password').value;

        if (password !== confirmPassword) {
            alert('Passwords do not match.');
            return;
        }

        const fullName = `${firstName} ${lastName}`;
        const username = email; // Use email as username for uniqueness

        try {
            const res = await fetch(`${API_BASE}/users/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password, fullName, phone: mobile })
            });

            if (res.ok) {
                currentUser = await res.json();
                CURRENT_USER_ID = currentUser.id;
                isLoggedIn = true;

                const extra = this.getUserExtra(CURRENT_USER_ID);
                extra.password = password;
                extra.username = username;
                extra.email = email;
                extra.fullName = fullName;
                extra.phone = mobile;
                this.saveUserExtra(CURRENT_USER_ID, extra);

                this.showToast(`Account created! Welcome, ${currentUser.fullName || currentUser.username}!`);
                this.closeAuthModal();
                this.loadUserProfile();
                this.updateAuthHeaderUI();
                await this.loadWishlist();
                this.showView('home');
            } else {
                const err = await res.json();
                alert(err.error || 'Failed to sign up.');
            }
        } catch (e) {
            console.error(e);
            alert('Error during sign up.');
        }
    },

    async signOut() {
        try {
            await fetch(`${API_BASE}/users/logout`, { method: 'POST' });
        } catch (e) {
            console.error(e);
        }
        isLoggedIn = false;
        CURRENT_USER_ID = null;
        currentUser = {};
        wishlistItems = [];

        this.clearAllForms();
        this.showToast('Signed out successfully.');
        this.updateAuthHeaderUI();
        this.showView('home');
    },

    async logout() {
        if (isAdminLoggedIn) {
            try {
                await fetch(`${API_BASE}/admin/logout`, { method: 'POST' });
            } catch (e) {
                console.error(e);
            }
            isAdminLoggedIn = false;
            currentAdminUser = {};
            this.showToast('Admin signed out.');
            this.showView('home');
        } else {
            this.signOut();
        }
    },

    updateAuthHeaderUI() {
        const loggedInMenu = document.getElementById('dropdown-logged-in-menu');
        const loggedOutMenu = document.getElementById('dropdown-logged-out-menu');
        const headerName = document.getElementById('header-user-name');
        const adminLink = document.getElementById('dropdown-admin-link');

        if (isLoggedIn && CURRENT_USER_ID) {
            loggedInMenu.style.display = 'block';
            loggedOutMenu.style.display = 'none';
            
            const displayName = currentUser.fullName ? currentUser.fullName.trim().split(' ')[0] : (currentUser.username || 'User');
            headerName.textContent = displayName;

            if (CURRENT_USER_ID === 2 || (currentUser && currentUser.role === 'ADMIN')) {
                adminLink.style.display = 'block';
            } else {
                adminLink.style.display = 'none';
            }
            this.updateHeaderAndProfileUI();
            this.loadNotifications();
        } else {
            loggedInMenu.style.display = 'none';
            loggedOutMenu.style.display = 'block';
            headerName.textContent = 'Guest';
            adminLink.style.display = 'none';
            document.getElementById('wishlist-badge').textContent = '0';

            const headerAvatarSvg = document.getElementById('header-avatar-svg');
            const headerAvatarImg = document.getElementById('header-avatar-img');
            if (headerAvatarImg) headerAvatarImg.style.display = 'none';
            if (headerAvatarSvg) headerAvatarSvg.style.display = 'block';
            
            const badge = document.getElementById('notifications-badge');
            if (badge) badge.style.display = 'none';
            const adminBadge = document.getElementById('admin-notifications-badge');
            if (adminBadge) adminBadge.style.display = 'none';
        }
    },

    openAdminContactReplyModal(id, originalMsg) {
        document.getElementById('admin-contact-reply-id').value = id;
        document.getElementById('admin-contact-original-msg').textContent = originalMsg;
        document.getElementById('admin-contact-reply-text').value = '';
        document.getElementById('admin-contact-reply-modal').style.display = 'flex';
    },

    closeAdminContactReplyModal() {
        document.getElementById('admin-contact-reply-modal').style.display = 'none';
    },

    async submitAdminContactReply(event) {
        event.preventDefault();
        const id = document.getElementById('admin-contact-reply-id').value;
        const replyText = document.getElementById('admin-contact-reply-text').value.trim();

        if (!replyText) return;

        try {
            const res = await fetch(`${API_BASE}/admin/contacts/${id}/reply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ replyText: replyText })
            });

            if (res.ok) {
                this.showToast('Reply sent to queue!');
                this.closeAdminContactReplyModal();
                setTimeout(() => this.loadAdminContacts(), 800);
            } else {
                alert('Failed to send reply.');
            }
        } catch (e) {
            console.error(e);
        }
    },

    async loadNotifications() {
        // Only load notifications if a user or admin is logged in
        if (!isLoggedIn && !isAdminLoggedIn) return;
        try {
            const res = await fetch(`${API_BASE}/users/notifications`);
            if (res.ok) {
                const notifications = await res.json();
                const unread = notifications.filter(n => n.status === 'PENDING');
                
                // 1. Render Admin dropdown notifications
                const adminBadge = document.getElementById('admin-notifications-badge');
                if (adminBadge) {
                    adminBadge.textContent = unread.length;
                    adminBadge.style.display = unread.length > 0 ? 'inline-block' : 'none';
                }
                const adminList = document.getElementById('admin-notifications-list');
                if (adminList) {
                    adminList.innerHTML = '';
                    if (notifications.length === 0) {
                        adminList.innerHTML = '<div style="text-align:center; padding:1rem; color:var(--text-muted); font-size:0.8rem;">No notifications.</div>';
                    } else {
                        notifications.forEach(n => {
                            const isUnread = n.status === 'PENDING';
                            let msgHtml = n.message;
                            let replyBtnHtml = '';
                            if (n.message.startsWith('CONTACT_ALERT|')) {
                                const parts = n.message.split('|');
                                const msgId = parts[1];
                                const senderName = parts[2];
                                const senderMsg = parts[3];
                                msgHtml = `<strong>New message from ${senderName}</strong>: "${senderMsg}"`;
                                if (isUnread) {
                                    replyBtnHtml = `<button class="btn btn-primary" style="padding:0.2rem 0.5rem; font-size:0.75rem; margin-top:0.4rem; margin-right:5px;" onclick="app.openAdminContactReplyModal(${msgId}, '${senderMsg.replace(/'/g, "\\'")}')">Reply</button>`;
                                }
                            }
                            const markReadBtnHtml = isUnread 
                                ? `<button class="btn btn-outline" style="padding:0.2rem 0.5rem; font-size:0.75rem; margin-top:0.4rem;" onclick="app.markNotificationRead(${n.id})">Mark Read</button>` 
                                : '';
                            adminList.innerHTML += `
                                <div style="padding:0.6rem 1rem; border-bottom:1px solid var(--border); font-size:0.8rem; background:${isUnread ? 'rgba(59, 130, 246, 0.05)' : 'transparent'};">
                                    <div style="color:var(--text-main); line-height:1.4; font-weight:${isUnread ? '600' : '400'};">${msgHtml}</div>
                                    <div style="display:flex; align-items:center;">${replyBtnHtml}${markReadBtnHtml}</div>
                                    <div class="text-muted" style="font-size:0.7rem; margin-top:0.25rem;">${new Date(n.sentAt).toLocaleString()}</div>
                                </div>
                            `;
                        });
                    }
                }

                // 2. Render Client dropdown notifications
                const badge = document.getElementById('notifications-badge');
                if (badge) {
                    badge.textContent = unread.length;
                    badge.style.display = unread.length > 0 ? 'inline-block' : 'none';
                }
                const list = document.getElementById('notifications-list');
                if (list) {
                    list.innerHTML = '';
                    if (notifications.length === 0) {
                        list.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-muted); font-size:0.85rem;">No notifications.</div>';
                    } else {
                        notifications.forEach(n => {
                            const isUnread = n.status === 'PENDING';
                            let msgHtml = n.message;
                            let actionBtnHtml = '';
                            if (n.message.startsWith('REPLY_ALERT|')) {
                                const parts = n.message.split('|');
                                const msgId = parts[1];
                                const replyText = parts[2];
                                const originalMsg = parts[3];
                                msgHtml = `<strong>Admin replied</strong>: "${replyText}" (to your query: "${originalMsg}")`;
                                actionBtnHtml = `<button class="btn btn-primary" style="padding:0.2rem 0.5rem; font-size:0.75rem; margin-top:0.4rem; margin-right:5px;" onclick="app.showView('contact')">Reply Back</button>`;
                            } else if (n.message.startsWith('CONTACT_ALERT|')) {
                                const parts = n.message.split('|');
                                const msgId = parts[1];
                                const senderName = parts[2];
                                const senderMsg = parts[3];
                                msgHtml = `<strong>New message from ${senderName}</strong>: "${senderMsg}"`;
                                if (isUnread) {
                                    actionBtnHtml = `<button class="btn btn-primary" style="padding:0.2rem 0.5rem; font-size:0.75rem; margin-top:0.4rem; margin-right:5px;" onclick="app.openAdminContactReplyModal(${msgId}, '${senderMsg.replace(/'/g, "\\'")}')">Reply</button>`;
                                }
                            }
                            const markReadBtnHtml = isUnread 
                                ? `<button class="btn btn-outline" style="padding:0.2rem 0.5rem; font-size:0.75rem; margin-top:0.4rem;" onclick="app.markNotificationRead(${n.id})">Mark Read</button>` 
                                : '';
                            list.innerHTML += `
                                <div style="padding:0.75rem 1rem; border-bottom:1px solid var(--border); font-size:0.85rem; background:${isUnread ? 'rgba(99, 102, 241, 0.05)' : 'transparent'};">
                                    <div style="color:var(--text-main); line-height:1.4; font-weight:${isUnread ? '600' : '400'};">${msgHtml}</div>
                                    <div style="display:flex; align-items:center;">${actionBtnHtml}${markReadBtnHtml}</div>
                                    <div class="text-muted" style="font-size:0.75rem; margin-top:0.25rem;">${new Date(n.sentAt).toLocaleString()}</div>
                                </div>
                            `;
                        });
                    }
                }
            }
        } catch (e) {
            console.error(e);
        }
    },

    toggleNotificationsDropdown(event) {
        if (event) event.stopPropagation();
        const dd = document.getElementById('notifications-dropdown');
        if (dd) {
            const isShown = dd.style.display === 'block';
            dd.style.display = isShown ? 'none' : 'block';
            if (!isShown) {
                this.loadNotifications();
            }
        }
    },

    toggleAdminNotificationsDropdown(event) {
        if (event) event.stopPropagation();
        const dd = document.getElementById('admin-notifications-dropdown');
        if (dd) {
            const isShown = dd.style.display === 'block';
            dd.style.display = isShown ? 'none' : 'block';
            if (!isShown) {
                this.loadNotifications();
            }
        }
    },

    async markAllNotificationsRead(event) {
        if (event) event.stopPropagation();
        try {
            const res = await fetch(`${API_BASE}/users/notifications/read-all`, { method: 'POST' });
            if (res.ok) {
                this.loadNotifications();
            }
        } catch (e) {
            console.error(e);
        }
    },

    async markAdminNotificationsRead(event) {
        if (event) event.stopPropagation();
        try {
            const res = await fetch(`${API_BASE}/users/notifications/read-all`, { method: 'POST' });
            if (res.ok) {
                this.loadNotifications();
            }
        } catch (e) {
            console.error(e);
        }
    },

    async markNotificationRead(id) {
        try {
            const res = await fetch(`${API_BASE}/users/notifications/${id}/read`, { method: 'POST' });
            if (res.ok) {
                this.loadNotifications();
            }
        } catch (e) {
            console.error(e);
        }
    },

    async submitContactForm(event) {
        if (event) event.preventDefault();

        const name    = document.getElementById('contact-name').value.trim();
        const email   = document.getElementById('contact-email').value.trim();
        const message = document.getElementById('contact-message').value.trim();

        if (!name || !email || !message) {
            this.showToast('Please fill in all fields.');
            return;
        }

        const submitBtn = event && event.target ? event.target.querySelector('button[type="submit"]') : null;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Sending...';
        }

        try {
            const res = await fetch(`${API_BASE}/users/contact`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, message })
            });

            if (res.ok) {
                this.showToast('✅ Message sent! We will get back to you soon.');
                // Clear form
                document.getElementById('contact-name').value    = '';
                document.getElementById('contact-email').value   = '';
                document.getElementById('contact-message').value = '';
            } else {
                const err = await res.json().catch(() => ({}));
                this.showToast('❌ Failed to send: ' + (err.error || 'Server error'));
            }
        } catch (e) {
            console.error('Contact form error:', e);
            this.showToast('❌ Network error. Please try again.');
        } finally {
            if (submitBtn) {
                submitBtn.disabled    = false;
                submitBtn.textContent = 'Send Message';
            }
        }
    },

    async loadAdminUsers() {
        try {
            const res = await fetch(`${API_BASE}/admin/users`);
            if (res.ok) {
                const users = await res.json();
                const tbody = document.getElementById('admin-users-table-body');
                if (tbody) {
                    tbody.innerHTML = '';
                    if (users.length === 0) {
                        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No users found.</td></tr>';
                        return;
                    }
                    users.forEach(u => {
                        tbody.innerHTML += `
                            <tr>
                                <td>#${u.id}</td>
                                <td>${u.username}</td>
                                <td>${u.email}</td>
                                <td>
                                    <select class="form-select" style="padding:0.2rem;" onchange="app.updateAdminUserRole(${u.id}, this.value)">
                                        <option value="CUSTOMER" ${u.role === 'CUSTOMER' ? 'selected' : ''}>CUSTOMER</option>
                                        <option value="ADMIN" ${u.role === 'ADMIN' ? 'selected' : ''}>ADMIN</option>
                                    </select>
                                </td>
                                <td>${u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '-'}</td>
                                <td>
                                    <button class="btn btn-outline" style="padding:0.2rem 0.5rem; color:var(--danger); border-color:var(--danger);" onclick="app.deleteAdminUser(${u.id})">Delete</button>
                                </td>
                            </tr>
                        `;
                    });
                }
            }
        } catch (e) {
            console.error(e);
        }
    },

    async updateAdminUserRole(id, role) {
        try {
            const res = await fetch(`${API_BASE}/admin/users/${id}/role?role=${role}`, { method: 'PUT' });
            if (res.ok) {
                this.showToast('User role updated successfully');
            } else {
                this.showToast('Failed to update role');
                this.loadAdminUsers();
            }
        } catch (e) {
            console.error(e);
        }
    },

    async deleteAdminUser(id) {
        if (!confirm('Are you sure you want to delete this user?')) return;
        try {
            const res = await fetch(`${API_BASE}/admin/users/${id}`, { method: 'DELETE' });
            if (res.ok) {
                this.showToast('User deleted successfully');
                this.loadAdminUsers();
            } else {
                this.showToast('Failed to delete user');
            }
        } catch (e) {
            console.error(e);
        }
    },

    async deleteAdminContact(id) {
        if (!confirm('Are you sure you want to delete this message?')) return;
        try {
            const res = await fetch(`${API_BASE}/admin/contacts/${id}`, { method: 'DELETE' });
            if (res.ok) {
                this.showToast('Message deleted.');
                this.loadAdminContacts();
            } else {
                alert('Failed to delete message.');
            }
        } catch (e) {
            console.error(e);
        }
    }
};

window.onload = () => app.init();
