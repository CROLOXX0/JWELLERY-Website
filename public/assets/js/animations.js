/* ==========================================================================
   Jwellery Premium Cinematic Animation Engine
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
    initScrollReveals();
    initHeroParallax();
    initMagneticButtons();
});

/**
 * Cinematic Scroll Reveal using IntersectionObserver
 */
function initScrollReveals() {
    const revealOptions = {
        threshold: 0.15,
        rootMargin: "0px 0px -50px 0px"
    };

    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Apply luxury fade-up animation
                entry.target.animate(
                    [
                        { opacity: 0, transform: "translateY(40px) scale(0.98)" },
                        { opacity: 1, transform: "translateY(0) scale(1)" }
                    ],
                    {
                        duration: 800,
                        easing: "cubic-bezier(0.25, 1, 0.5, 1)",
                        fill: "forwards"
                    }
                );
                
                // Add a active class and stop observing
                entry.target.classList.add("revealed");
                observer.unobserve(entry.target);
            }
        });
    }, revealOptions);

    // Select elements to reveal
    const elementsToReveal = document.querySelectorAll(".reveal-fade, .luxury-card, .section-header");
    elementsToReveal.forEach(el => {
        el.style.opacity = "0"; // initial state
        revealObserver.observe(el);
    });
}

/**
 * 3D Parallax Mouse Reactive Movement for the Hero Section
 */
function initHeroParallax() {
    const heroSection = document.querySelector(".hero");
    const parallaxImages = document.querySelectorAll(".parallax-img");
    const parallaxTexts = document.querySelectorAll(".parallax-text");

    if (!heroSection) return;

    heroSection.addEventListener("mousemove", (e) => {
        const { width, height } = heroSection.getBoundingClientRect();
        const moveX = (e.clientX - width / 2) / (width / 2); // Ranges from -1 to 1
        const moveY = (e.clientY - height / 2) / (height / 2);

        // Slide background and images subtly
        parallaxImages.forEach(img => {
            const depth = img.getAttribute("data-depth") || 0.15;
            const x = moveX * depth * 35;
            const y = moveY * depth * 35;
            img.style.transform = `translate(${x}px, ${y}px) scale(1.05)`;
        });

        // Slide headers/texts oppositely for a 3D split-depth feel
        parallaxTexts.forEach(text => {
            const depth = text.getAttribute("data-depth") || 0.08;
            const x = -moveX * depth * 25;
            const y = -moveY * depth * 25;
            text.style.transform = `translate(${x}px, ${y}px)`;
        });
    });

    // Reset when mouse leaves
    heroSection.addEventListener("mouseleave", () => {
        parallaxImages.forEach(img => {
            img.style.transition = "transform 0.8s cubic-bezier(0.25, 1, 0.5, 1)";
            img.style.transform = "translate(0px, 0px) scale(1)";
        });
        parallaxTexts.forEach(text => {
            text.style.transition = "transform 0.8s cubic-bezier(0.25, 1, 0.5, 1)";
            text.style.transform = "translate(0px, 0px)";
        });
    });
}

/**
 * Interactive Gold/Diamond Shimmer Effect on Product Cards Hover
 * Dynamically updates gradient positioning based on mouse hover coordinates.
 */
function applyBrillianceShine(card, e) {
    const shimmer = card.querySelector(".shimmer-overlay");
    if (!shimmer) return;

    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    shimmer.style.background = `radial-gradient(circle 120px at ${x}px ${y}px, rgba(232, 197, 200, 0.45) 0%, rgba(255,255,255,0) 70%)`;
}

/**
 * Micro-Interaction: Magnetic Hover Effect for Buttons
 */
function initMagneticButtons() {
    const magneticBtns = document.querySelectorAll(".btn-magnetic");
    
    magneticBtns.forEach(btn => {
        btn.addEventListener("mousemove", (e) => {
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            
            // Move slightly towards the mouse
            btn.style.transform = `translate(${x * 0.3}px, ${y * 0.3}px)`;
        });
        
        btn.addEventListener("mouseleave", () => {
            btn.style.transform = `translate(0px, 0px)`;
        });
    });
}

/**
 * Fly-to-Cart Particle Burst Animation
 * Triggers small glowing rose-gold beads that float up towards the cart icon.
 */
function animateFlyToCart(event, cartIconSelector = ".cart-icon-btn") {
    const target = event.currentTarget;
    const cartIcon = document.querySelector(cartIconSelector);
    if (!cartIcon) return;

    const startRect = target.getBoundingClientRect();
    const endRect = cartIcon.getBoundingClientRect();

    // Create 4 delicate shimmering gold sparkles
    for (let i = 0; i < 4; i++) {
        const particle = document.createElement("div");
        particle.className = "luxury-particle";
        document.body.appendChild(particle);

        const startX = startRect.left + startRect.width / 2 + (Math.random() - 0.5) * 20;
        const startY = startRect.top + startRect.height / 2 + (Math.random() - 0.5) * 20;
        
        const endX = endRect.left + endRect.width / 2;
        const endY = endRect.top + endRect.height / 2;

        particle.style.left = `${startX}px`;
        particle.style.top = `${startY}px`;

        // Mid-point control for Bezier curve path simulation
        const midX = (startX + endX) / 2 + (Math.random() - 0.5) * 100;
        const midY = (startY + endY) / 2 - 120 - Math.random() * 80;

        particle.animate(
            [
                { 
                    left: `${startX}px`, 
                    top: `${startY}px`, 
                    opacity: 1, 
                    transform: "scale(1.2) rotate(0deg)" 
                },
                { 
                    left: `${midX}px`, 
                    top: `${midY}px`, 
                    opacity: 0.8, 
                    transform: "scale(1.5) rotate(180deg)" 
                },
                { 
                    left: `${endX}px`, 
                    top: `${endY}px`, 
                    opacity: 0, 
                    transform: "scale(0.3) rotate(360deg)" 
                }
            ],
            {
                duration: 900 + i * 150,
                easing: "cubic-bezier(0.075, 0.82, 0.165, 1)",
                fill: "forwards"
            }
        );

        // Remove element after complete animation
        setTimeout(() => particle.remove(), 1500);
    }

    // Scale-pop feedback for the cart icon
    setTimeout(() => {
        cartIcon.animate(
            [
                { transform: "scale(1)" },
                { transform: "scale(1.25) rotate(-5deg)", color: "var(--accent-rose)" },
                { transform: "scale(1)" }
            ],
            {
                duration: 400,
                easing: "cubic-bezier(0.175, 0.885, 0.32, 1.275)"
            }
        );
    }, 900);
}
window.animateFlyToCart = animateFlyToCart;
window.applyBrillianceShine = applyBrillianceShine;
