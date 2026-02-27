import { motion } from 'framer-motion';
import {
  siCursor,
  siClaude,
  siWindsurf,
  siGithubcopilot,
  siGooglegemini,
} from 'simple-icons';

// VS Code and ChatGPT not in simple-icons; using official brand SVG paths
const VSCODE_PATH =
  'M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.94-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352z';
const CHATGPT_PATH =
  'M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.8956zm16.5963 3.8558L13.1038 8.364l2.0201-1.1638a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997z';

// Brand logos: simple-icons + custom (VS Code, ChatGPT)
const LOGOS: Array<{ title: string; path: string; color: string }> = [
  { title: siCursor.title, path: siCursor.path, color: `#${siCursor.hex}` },
  { title: 'Visual Studio Code', path: VSCODE_PATH, color: '#007ACC' },
  { title: siClaude.title, path: siClaude.path, color: `#${siClaude.hex}` },
  { title: siWindsurf.title, path: siWindsurf.path, color: `#${siWindsurf.hex}` },
  { title: 'ChatGPT', path: CHATGPT_PATH, color: '#10a37f' },
  { title: siGooglegemini.title, path: siGooglegemini.path, color: `#${siGooglegemini.hex}` },
  { title: siGithubcopilot.title, path: siGithubcopilot.path, color: `#${siGithubcopilot.hex}` },
];

// Card width (w-20=80px) + gap (gap-8=32px) = 112px per item; scroll one set for seamless loop
const CARD_WIDTH = 112;
const SCROLL_DISTANCE = LOGOS.length * CARD_WIDTH;

export default function LogoCarousel() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      className="mt-16 flex flex-col items-center overflow-hidden"
    >
      <div className="relative w-full max-w-2xl overflow-hidden mb-6">
        <motion.div
          className="flex shrink-0 gap-8"
          animate={{ x: [0, -SCROLL_DISTANCE] }}
          transition={{
            x: { duration: 10, repeat: Infinity, ease: 'linear' },
          }}
        >
          {[...LOGOS, ...LOGOS].map((logo, i) => (
            <div
              key={`${logo.title}-${i}`}
              className="flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-xl bg-white/80 backdrop-blur border border-gray-200 shadow-sm hover:shadow-md transition-shadow shrink-0"
            >
              <svg
                viewBox="0 0 24 24"
                className="w-8 h-8 md:w-10 md:h-10 shrink-0"
                fill={logo.color}
                aria-label={logo.title}
              >
                <path d={logo.path} />
              </svg>
            </div>
          ))}
        </motion.div>
      </div>
      <p className="text-sm text-white/80 uppercase tracking-wider">Works with your AI editor</p>
    </motion.div>
  );
}
