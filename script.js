const container = document.getElementById("container");
const signInButton = document.getElementById("signIn");
const signUpButton = document.getElementById("signUp");

signUpButton.addEventListener("click",()=>{
container.classList.add("right-panel-active")
 })
 signInButton.addEventListener("click",()=>{
container.classList.remove("right-panel-active")
 })