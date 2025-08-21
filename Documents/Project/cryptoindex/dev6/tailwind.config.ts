import type { Config } from "tailwindcss";

// all in fixtures is set to tailwind v3 as interims solutions

const config: Config = {
    darkMode: ["class"],
    content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
  	extend: {
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			},
  			cryptoindex: {
  				'primary': '#555879',
  				'medium': '#98A1BC',
  				'accent': '#898AC4',
  				'highlight': '#C0C9EE',
  				'soft': '#A2AADB',
  				'warm': '#DED3C4',
  				'cream': '#F4EBD3'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			},
  			'gradient': {
  				'0%, 100%': {
  					'background-size': '200% 200%',
  					'background-position': 'left center'
  				},
  				'50%': {
  					'background-size': '200% 200%',
  					'background-position': 'right center'
  				}
  			},
  			'float': {
  				'0%, 100%': { transform: 'translateY(0px)' },
  				'50%': { transform: 'translateY(-10px)' }
  			},
  			'blur-in': {
  				'0%': { 
  					opacity: '0', 
  					filter: 'blur(10px)',
  					transform: 'scale(0.9)'
  				},
  				'100%': { 
  					opacity: '1', 
  					filter: 'blur(0px)',
  					transform: 'scale(1)'
  				}
  			},
  			'slide-in': {
  				'0%': { 
  					opacity: '0', 
  					transform: 'translateY(20px)'
  				},
  				'100%': { 
  					opacity: '1', 
  					transform: 'translateY(0px)'
  				}
  			},
  			'fade-in': {
  				'0%': { opacity: '0' },
  				'100%': { opacity: '1' }
  			},
  			'ripple': {
  				'0%': { 
  					transform: 'scale(0)', 
  					opacity: '1' 
  				},
  				'100%': { 
  					transform: 'scale(4)', 
  					opacity: '0' 
  				}
  			},
  			'shimmer': {
  				'0%': {
  					'background-position': '-200% center'
  				},
  				'100%': {
  					'background-position': '200% center'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			'gradient': 'gradient 8s linear infinite',
  			'float': 'float 3s ease-in-out infinite',
  			'blur-in': 'blur-in 0.5s ease-out',
  			'slide-in': 'slide-in 0.4s ease-out',
  			'fade-in': 'fade-in 0.3s ease-out',
  			'ripple': 'ripple 0.6s linear',
  			'shimmer': 'shimmer 2s linear infinite'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
