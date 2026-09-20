document.addEventListener('DOMContentLoaded', () => {
  /* Navbar Scroll Effect */
    const navbar = document.getElementById('navbar');

    const handleNavbarScroll = () => {
    if (!navbar) return;

    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
    };

    window.addEventListener('scroll', handleNavbarScroll);
    handleNavbarScroll();

  /* Animaciones Reveal mediante IntersectionObserver */
    const revealElements = document.querySelectorAll('.reveal');

  const revealOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };

  function startCounter(element) {
    if (!element) return;

    const target = parseInt(element.getAttribute('data-target'), 10);

    if (Number.isNaN(target)) return;

    const duration = 2000;
    const increment = target / (duration / 16);
    let current = 0;

    const isPercentage = element.innerText.includes('%');

    const updateCounter = () => {
      current += increment;

      if (current < target) {
        element.innerText = isPercentage
          ? Math.ceil(current) + '%'
          : '+' + Math.ceil(current);

        requestAnimationFrame(updateCounter);
      } else {
        element.innerText = isPercentage
          ? target + '%'
          : '+' + target;
      }
    };

    updateCounter();
  }

  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');

          if (entry.target.classList.contains('stat-card')) {
            startCounter(entry.target.querySelector('.stat-number'));
          }

          observer.unobserve(entry.target);
        }
      });
    }, revealOptions);

    revealElements.forEach(el => {
      revealObserver.observe(el);
    });
  } else {
    revealElements.forEach(el => {
      el.classList.add('active');

      if (el.classList.contains('stat-card')) {
        startCounter(el.querySelector('.stat-number'));
      }
    });
  }
});