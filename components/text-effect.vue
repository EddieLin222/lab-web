<template>
  <div class="test" contenteditable>
    Squiggly Text
    <p class="small">– with –</p>
    SVG Filters
    <p class="small">(you can even edit this text)</p>
    <p class="smaller">(only tested on Chrome so far)</p>
  </div>

  <svg xmlns="http://www.w3.org/2000/svg" version="1.1">
    <defs>
      <filter id="squiggly-0">
        <feTurbulence id="turbulence" baseFrequency="0.02" numOctaves="3" result="noise" seed="0" />
        <feDisplacementMap id="displacement" in="SourceGraphic" in2="noise" scale="6" />
      </filter>
      <filter id="squiggly-1">
        <feTurbulence id="turbulence" baseFrequency="0.02" numOctaves="3" result="noise" seed="1" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="8" />
      </filter>

      <filter id="squiggly-2">
        <feTurbulence id="turbulence" baseFrequency="0.02" numOctaves="3" result="noise" seed="2" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="6" />
      </filter>
      <filter id="squiggly-3">
        <feTurbulence id="turbulence" baseFrequency="0.02" numOctaves="3" result="noise" seed="3" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="8" />
      </filter>

      <filter id="squiggly-4">
        <feTurbulence id="turbulence" baseFrequency="0.02" numOctaves="3" result="noise" seed="4" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="6" />
      </filter>
    </defs>
  </svg>
</template>
<style lang="sass" scoped>
@import url('https://fonts.googleapis.com/css?family=Amatic+SC:400,700')

body
  font-family: 'Amatic SC', sans-serif
  font-size: 100px

@keyframes squiggly-anim
  0%
    filter: url('#squiggly-0')
  
  25%
    filter: url('#squiggly-1')
  
  50%
    filter: url('#squiggly-2')
  
  75%
    filter: url('#squiggly-3')
  
  100%
    filter: url('#squiggly-4')
  
@mixin squiggly-animation
  animation: squiggly-anim 0.34s linear infinite

body
  line-height: 100vh
  background: #111
  color: white
  
.test
  @include squiggly-animation
  display: inline-block
  vertical-align: middle
  width: 100%
  
  outline: none
  text-align: center
  line-height: 1


.small
  font-size: 0.5em

.smaller
  font-size: 0.4em
p
  margin: 0
</style>

<script lang="ts" setup>
import gsap from 'gsap'
onMounted(() => {
  var bt = document.querySelectorAll('.button')[0],
    turbVal = { val: 0.000001 },
    turb = document.querySelectorAll('#noise feTurbulence')[0],

    btTl = gsap.timeline({
      paused: true, onUpdate: function () {
        turb.setAttribute('baseFrequency', '0 ' + turbVal.val);
      }
    });

  btTl.to(turbVal, 0.2, { val: 0.2 })
    .to(turbVal, 0.2, { val: 0.000001 });

  bt.addEventListener('click', function () {
    btTl.restart();
  });
})

</script>