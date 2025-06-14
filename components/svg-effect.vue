<template>
  <div class="wrapper">
    <svg viewBox="0 0 180 100">
      <filter id='noise' x='0%' y='0%' width='100%' height='100%'>
        <feTurbulence type="fractalNoise" baseFrequency="0 0.000001" result="NOISE" numOctaves="2" />
        <feDisplacementMap in="SourceGraphic" in2="NOISE" scale="30" xChannelSelector="R" yChannelSelector="R">
        </feDisplacementMap>
      </filter>
    </svg>
  </div>
  <button class="button">Click Me</button>
</template>
<style lang="sass" scoped>
svg
	height: 0
	width: 0
	visibility: hidden

.wrapper
	max-width: 80%

button
	font-family: inherit
	background: #2F3791
	border: none
	border-radius: 3px
	color: #fff
	padding: .75em 1em
	letter-spacing: 2px
	
	&:focus
		outline: none
		
		box-shadow: 0 0 0 5px #212121, 0 0 0 7px orange
	
	&:hover
		cursor: pointer

button
	-webkit-filter: url(#noise)
	filter: url(#noise)
</style>

<script lang="ts" setup>
import gsap from 'gsap'
onMounted(()=>{
  var bt = document.querySelectorAll('.button')[0],
    turbVal = { val: 0.000001 },
    turb = document.querySelectorAll('#noise feTurbulence')[0],
    
    btTl = gsap.timeline({ paused: true, onUpdate: function() {
    turb.setAttribute('baseFrequency', '0 ' + turbVal.val);
  } });
  
  btTl.to(turbVal, 0.2, { val: 0.2 })
      .to(turbVal, 0.2, { val: 0.000001 });
  
  bt.addEventListener('click', function() {
    btTl.restart();
  });
})

</script>