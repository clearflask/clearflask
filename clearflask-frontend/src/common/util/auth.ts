import CryptoJS from 'crypto-js';

/**
 * Warning: changing this method will result in everyone's passwords to change
 */
export function saltHashPassword(password:string):string {
  var hash = CryptoJS.SHA512(password + "salt:D55ABD2F392D40648DF6E7AECD98678D");
  var hashStr = hash.toString(CryptoJS.enc.Base64);
  return hashStr;
}