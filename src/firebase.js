import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'

const firebaseConfig = {
  apiKey: "AIzaSyDyhe4L4Q0SFWox0XCdm1g2JZWtu-pQHLI",
  authDomain: "senselifemaker.firebaseapp.com",
  databaseURL: "https://senselifemaker-default-rtdb.firebaseio.com",
  projectId: "senselifemaker",
  storageBucket: "senselifemaker.firebasestorage.app",
  messagingSenderId: "232028855315",
  appId: "1:232028855315:web:838ebbc814047099f673e6",
}

const app = initializeApp(firebaseConfig)
export const db = getDatabase(app)
